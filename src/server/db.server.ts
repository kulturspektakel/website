import {createRequire} from 'node:module';
import {Pool, neonConfig} from '@neondatabase/serverless';
import {drizzle} from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as relations from './db/relations';
import * as tables from './db/schema';

// The Drizzle counterpart of `prismaClient.server.ts`, the single place the app
// connects with Drizzle. Both run side by side against the same database while
// the code moves over (see docs/drizzle-migration-plan.md).
//
// Timestamps: Drizzle hands zone-less `timestamp` values through as strings
// and the `mode: 'date'` columns read them as UTC, like Prisma. Raw
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
  return drizzle({
    client: new Pool({
      connectionString: process.env.DATABASE_URL + '&connect_timeout=10',
    }),
    schema,
  });
}

// Typed as the Neon variant; the node-postgres one used in tests has the same
// query API.
export const db = createDb() as ReturnType<typeof drizzle<typeof schema>>;

// The `tx` handed to `db.transaction(async (tx) => …)`, for helpers that run
// inside a caller's transaction.
export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
