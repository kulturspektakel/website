import {PrismaClient} from '@prisma/client';
import {PrismaNeon} from '@prisma/adapter-neon';
import {neonConfig} from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// To work in edge environments (Cloudflare Workers, Vercel Edge, etc.), enable querying over fetch
// neonConfig.poolQueryViaFetch = true;

export const prismaClient = new PrismaClient({
  adapter: new PrismaNeon({
    connectionString: process.env.DATABASE_URL + '&connect_timeout=10',
  }),
});
