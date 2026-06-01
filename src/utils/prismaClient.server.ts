import {createRequire} from 'node:module';
import {PrismaClient} from '../generated/prisma/client';
import {PrismaNeon} from '@prisma/adapter-neon';
import {neonConfig} from '@neondatabase/serverless';
import ws from 'ws';

function createAdapter() {
  // Tests set `DB_DRIVER=pg` and point `TEST_DATABASE_URL` at a plain Postgres
  // (an in-memory PGlite socket), using the node-postgres adapter instead of
  // the Neon serverless driver. These two vars are intentionally absent from
  // `.env`, so the production path below can never be affected by them and
  // tests can never accidentally talk to the real database.
  if (process.env.DB_DRIVER === 'pg') {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) {
      throw new Error('DB_DRIVER=pg requires TEST_DATABASE_URL');
    }
    const {PrismaPg} = createRequire(import.meta.url)('@prisma/adapter-pg');
    // PGlite is single-connection, so cap the pool at one.
    return new PrismaPg({connectionString: url, max: 1});
  }

  neonConfig.webSocketConstructor = ws;
  return new PrismaNeon({
    connectionString: process.env.DATABASE_URL + '&connect_timeout=10',
  });
}

export const prismaClient = new PrismaClient({adapter: createAdapter()});
