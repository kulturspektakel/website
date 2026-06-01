import {PGlite} from '@electric-sql/pglite';
import {citext} from '@electric-sql/pglite/contrib/citext';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {unaccent} from '@electric-sql/pglite/contrib/unaccent';
import {uuid_ossp} from '@electric-sql/pglite/contrib/uuid_ossp';
import {PGLiteSocketServer} from '@electric-sql/pglite-socket';
import {execFileSync, spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {existsSync, readFileSync} from 'node:fs';

/**
 * One-time setup for the whole e2e run: boots an in-memory Postgres (PGlite)
 * seeded with the real Prisma schema, exposes it over a socket, and starts the
 * actual dev server pointed at it via the node-postgres adapter. Connection
 * details are handed to the colocated route tests through `provide` (see
 * test/e2e/client.ts). No Docker or network required.
 */
type E2EInfo = {baseUrl: string; dbUrl: string; salt: string};

declare module 'vitest' {
  interface ProvidedContext {
    e2e: E2EInfo;
  }
}

// Resolve the device-auth salt the e2e run should use: an explicit env var
// wins, then a local `.env`, otherwise a fixed test value (e.g. in CI). The
// chosen value is written back to `process.env` so the spawned dev server —
// which inherits it — signs and verifies with the same salt.
function resolveContactlessSalt(): string {
  if (process.env.CONTACTLESS_SALT) {
    return process.env.CONTACTLESS_SALT;
  }
  const match =
    existsSync('.env') && readFileSync('.env', 'utf8').match(/^CONTACTLESS_SALT=(.*)$/m);
  if (match) {
    return match[1].trim().replace(/^["']|["']$/g, '');
  }
  return 'e2e-test-salt';
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const {port} = srv.address() as {port: number};
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export default async function setup({
  provide,
}: {
  provide: (key: 'e2e', value: E2EInfo) => void;
}) {
  const salt = resolveContactlessSalt();
  process.env.CONTACTLESS_SALT = salt;

  const db = await PGlite.create({
    extensions: {citext, pg_trgm, pgcrypto, unaccent, uuid_ossp},
  });
  const ddl = execFileSync(
    'node_modules/.bin/prisma',
    ['migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      // prisma.config.ts resolves env('DATABASE_URL'); this diff is offline and
      // never connects, but the value must exist (e.g. in CI without a .env).
      env: {...process.env, DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://placeholder'},
    },
  );
  await db.exec(ddl);

  // graphile-worker lives outside the Prisma schema. Mock its `add_job` with a
  // no-op so `scheduleTask` succeeds in tests without a real worker.
  await db.query('CREATE SCHEMA graphile_worker');
  await db.query(
    `CREATE FUNCTION graphile_worker.add_job(identifier text, payload json DEFAULT NULL)
     RETURNS void LANGUAGE plpgsql AS $$ BEGIN END; $$`,
  );

  const dbPort = await freePort();
  // Allow several connections: the dev server's pool plus each test's client.
  const socket = new PGLiteSocketServer({
    db,
    port: dbPort,
    host: '127.0.0.1',
    maxConnections: 10,
  });
  await socket.start();
  const dbUrl = `postgresql://localhost:${dbPort}/postgres`;

  const serverPort = await freePort();
  const server = spawn(
    'node_modules/.bin/vite',
    ['dev', '--port', String(serverPort), '--strictPort'],
    {
      env: {...process.env, DB_DRIVER: 'pg', TEST_DATABASE_URL: dbUrl},
      stdio: 'ignore',
    },
  );
  const baseUrl = `http://localhost:${serverPort}`;

  const stop = async () => {
    server.kill('SIGTERM');
    await socket.stop();
    await db.close();
  };

  let ready = false;
  for (let i = 0; i < 90; i++) {
    try {
      await fetch(`${baseUrl}/`);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!ready) {
    await stop();
    throw new Error('dev server did not become ready');
  }

  provide('e2e', {baseUrl, dbUrl, salt});

  return stop;
}
