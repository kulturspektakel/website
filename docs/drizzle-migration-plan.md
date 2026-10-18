# Migrating from Prisma to Drizzle

Plan for replacing Prisma 7 with Drizzle ORM, incrementally: both run against
the same database while the code moves over module by module, and Prisma is
removed at the end. Started 2026-10-18; phases 0 and 1 are done.

## Why

Vercel Hobby's CPU budget is the only real constraint, and cold starts are most
of it. A cold Node process that imports the ORM and runs one query, bundled
with esbuild (2026-10-18, local, median of 9 runs):

| | Bundle | Import + init | First query (wall) | Process CPU |
|---|---|---|---|---|
| Prisma 7 (`PrismaNeon`) | 5.5 MB | 30 ms | 162 ms | **342 ms** |
| Drizzle 0.45 (`neon-serverless`) | 0.7 MB | 22 ms | 186 ms | **88 ms** |

Wall time is network-bound and about equal; CPU per cold start drops by
~250 ms. Secondary gains: typed Neon Realtime queries via
`@neon/realtime-drizzle` (replacing the hand-written SQL in
`src/server/realtime.server.ts`), no 2.8 MB generated client in git,
`directus_users` modelled read-only instead of `$queryRaw`.

Re-measure on Vercel (Observability → Functions, Active CPU per invocation)
before and after, not just locally.

## Versions

`drizzle-orm` **0.45.x** + `drizzle-kit` 0.31. `@neon/realtime-drizzle` 0.1
requires `drizzle-orm >=0.45.2 <0.46`, so not the 1.0 release candidates (new
relational-query API) yet. Prisma's client-side `cuid()` ids become
`crypto.randomUUID()` (a cuid library added ~5 ms CPU to every cold start just
by being imported).

## Phase 0 — schema and baseline (done)

- `drizzle.config.ts`: `schemaFilter: ['public']` (the same database holds
  `directus` and a leftover `graphile_worker`, which drizzle-kit must never
  touch). Uses a direct (non-pooler) connection; `DRIZZLE_DATABASE_URL`
  overrides `DATABASE_URL`, e.g. to point drizzle-kit at a local database.
- `src/server/db/schema.ts` + `relations.ts`: `drizzle-kit pull` from
  production, then fixed by hand:
  - timestamps `mode: 'date'` (pull emits `'string'`; the app expects `Date`);
  - `citext` (`BandApplicationTag.tag`) and `bytea` (`CardTransaction.crewCardId`,
    `CrewCard.id`, `NoiseLog.bands`) as custom types (pull emits `unknown`);
  - Prisma's client-side defaults: `Viewer.id` `crypto.randomUUID()`, seven
    `cuid()` ids, `Viewer.updatedAt` `$onUpdate`;
  - wrong opclasses on every index column removed (a pull bug; production uses
    the defaults);
  - `NoiseLog.laeq30m` etc. (pull produced `laeq30M`);
  - `BandApplicationRating` primary key column order `(viewerId,
    bandApplicationId)` as in production (it's also the index);
  - `_ProductToProductAdditives` keys named `A`/`B` like the columns.
- Verified by round trip on a throwaway local Postgres 18: a schema-only copy
  of production vs. an empty database built by `drizzle-kit push` from
  `schema.ts`, compared via sorted `pg_dump --schema-only` statements. Equal,
  except:
  - functions `f_unaccent`, `slugify`, `set_slug_from_title` and the trigger
    `news_generate_slug` on `News` — Drizzle schemas can't express them; they
    stay in the database and need a custom SQL migration in phase 3 so they're
    recorded somewhere;
  - `ProductList`'s sequence is `productlist_id_seq` in production
    (`serial()` creates `ProductList_id_seq` on a fresh database; drizzle-kit
    doesn't compare sequence names, so production is unaffected).
- `drizzle-kit push` against the production copy always wants to drop and
  re-add `_ProductToProductAdditives_AB_pkey`, even right after creating it —
  an introspection bug, harmless but noisy. Another reason to use generated
  migrations rather than `push` in phase 3.

## Phase 1 — plumbing (done)

- `src/server/db.server.ts`: `db = drizzle({client: Pool, schema})` on
  `drizzle-orm/neon-serverless`, same driver, URL and `connect_timeout` as
  `prismaClient.server.ts`. Verified against production (read-only): same
  timestamps as Prisma, relational queries work.
- Timestamps: the driver hands zone-less `timestamp` values through as strings
  and `mode: 'date'` columns read and write them as UTC, like Prisma. Raw
  `db.execute(sql…)` results keep them as strings.
- Tests: the e2e harness stays as it is. `db.server.ts` honours the same
  `DB_DRIVER=pg` + `TEST_DATABASE_URL` switch as `prismaClient.server.ts`
  (node-postgres against the PGlite socket, pool of one). Checked by hand:
  defaults (`uuid`), `updatedAt` and a UTC round trip. Unit-test mocks
  of `prismaClient` move with their modules in phase 2; the e2e DDL keeps
  coming from `prisma migrate diff` until phase 3.
- Enums: `src/utils/enums.ts` (`as const` objects + union types, identical to
  Prisma's generated ones); `schema.ts` builds its `pgEnum`s from them. All
  enum imports now come from there; `generated/prisma` is only imported for
  `Prisma`, `PrismaClient` and model types, which go with their modules.
- `withTxid` moves to Drizzle together with the booking write fns (its only
  callers), so there's no unused copy in between.

## Phase 2 — move the queries (most of the work)

~80 files, ~140 Prisma calls, 21 raw queries, 8 transactions. Hottest paths
first: the public `_main` page loader, OwnTracks, Stripe/Kultcash/SAML, the
task handlers; then crew; scripts last. One area per commit, each deployable on
its own.

- `findMany`/`findUnique` with `select` → `db.query.x.findMany({columns, with})`
- `_count` → a `sql<number>` subquery or `count()` + `groupBy`
- `upsert` → `insert().onConflictDoUpdate()`
- `$queryRaw` → `sql` templates or plain queries
- booking live queries → `@neon/realtime-drizzle`

## Phase 3 — hand over the schema, remove Prisma

- Generated migrations (`drizzle-kit generate` + `migrate`) instead of
  `db push`: local `.env` is the production database, so a reviewable SQL
  migration is the safety net `db push` never had. Baseline = the current
  schema, marked as applied; plus a custom migration recording the functions
  and the trigger.
- `directus_users` read-only in a `pgSchema('directus')` outside the
  `schemaFilter`.
- Delete `prisma/`, `prisma.config.ts`, `src/generated/prisma`, the Prisma
  packages; measure cold starts on Vercel again.

## Watch out for

- `@updatedAt` and `cuid()`/`uuid()` are client-side in Prisma; in Drizzle
  only the `$onUpdate`/`$defaultFn` in `schema.ts` apply them, and only for
  writes through Drizzle.
- Until phase 3, Prisma owns the schema: change `prisma/schema.prisma` first,
  then mirror it in `src/server/db/schema.ts`.
- New rows in the former `cuid()` tables get uuids (36 characters; existing
  rows keep their 25-character cuids). Nothing validates the format.
- Until phase 3, nothing checks that `src/server/db/schema.ts` still matches
  `prisma/schema.prisma`: the e2e database is built from Prisma's DDL. Repeat
  the phase-0 round trip after schema changes.
