import 'dotenv/config';
import {defineConfig} from 'drizzle-kit';

// drizzle-kit needs a direct connection: Neon's pooler doesn't support
// everything introspection and DDL use, and `pgbouncer=true` is a Prisma-only
// parameter that node-postgres would send to the server as a setting.
function directUrl(url: string) {
  const u = new URL(url);
  u.hostname = u.hostname.replace('-pooler.', '.');
  u.searchParams.delete('pgbouncer');
  return u.toString();
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  // Only the app's tables. The same database also holds Directus (`directus`)
  // and a leftover `graphile_worker` schema, which drizzle-kit must never
  // touch.
  schemaFilter: ['public'],
  // Keep column names as they are when pulling (the default camelCases them,
  // which turned `laeq30m` into `laeq30M`).
  introspect: {casing: 'preserve'},
  dbCredentials: {
    url: directUrl(
      process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL!,
    ),
  },
});
