import {createRequire} from 'node:module';
import {Pool, neonConfig} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-serverless';
import {DrizzleQueryError} from 'drizzle-orm/errors';
import ws from 'ws';
import * as relations from './db/relations';
import * as tables from './db/schema';

// The single place the app connects to the database.
//
// Timestamps: Drizzle hands zone-less `timestamp` values through as strings
// and the `mode: 'date'` columns read and write them as UTC. Raw
// `db.execute(sql…)` results keep them as strings.
const schema = {...tables, ...relations};

function createDb() {
  // Tests set `DB_DRIVER=pg` and point `TEST_DATABASE_URL` at a plain Postgres
  // (an in-memory PGlite socket), using node-postgres instead of the Neon
  // serverless driver. These two vars are intentionally absent from `.env`, so
  // the production path below can never be affected by them and tests can
  // never accidentally talk to the real database.
  if (process.env.DB_DRIVER === 'pg') {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error('DB_DRIVER=pg requires TEST_DATABASE_URL');
    }
    const {drizzle: drizzlePg} = createRequire(import.meta.url)(
      'drizzle-orm/node-postgres',
    ) as typeof import('drizzle-orm/node-postgres');
    // PGlite is single-connection, so cap the pool at one.
    return drizzlePg({connection: {connectionString: url, max: 1}, schema});
  }

  neonConfig.webSocketConstructor = ws;
  const connectionString = new URL(process.env.DATABASE_URL!);
  connectionString.searchParams.set('connect_timeout', '10');
  return drizzle({
    client: new Pool({connectionString: connectionString.href}),
    schema,
  });
}

// Typed as the Neon variant; the node-postgres one used in tests has the same
// query API.
export const db = createDb() as ReturnType<typeof drizzle<typeof schema>>;

// The `tx` handed to `db.transaction(async (tx) => …)`, for helpers that run
// inside a caller's transaction.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Either `db` or a transaction, for helpers that work both ways.
export type DbExecutor = typeof db | DbTransaction;

// Whether a query failed on a unique constraint (Postgres 23505), for writes
// that can't skip a duplicate up front.
export function isUniqueViolation(e: unknown) {
  return (
    e instanceof DrizzleQueryError &&
    (e.cause as {code?: string} | undefined)?.code === '23505'
  );
}
