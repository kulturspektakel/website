# Booking page: live data with Neon Realtime + TanStack DB

A plan for making `/crew/booking/$eventId` live: when one crew member rates,
tags, comments on or moves a band, everyone else's table updates in place, and
our own writes show up optimistically without a `router.invalidate()` round
trip. Researched 2026-10-17; implemented 2026-10-18 (the plan below is kept as
written, apart from the collection table). Realtime needed Postgres 18, so the
database moved to a new Neon project the same day.

## Status of the pieces (as of 2026-10-17)

- **Neon Realtime** — public beta since 15–16 Oct 2026, SDK `0.1.x`, wire
  protocol not yet stable. Free during the beta. eu-central-1 (our region) is
  supported. Built by the Electric team after they joined Neon.
- **TanStack DB** — pre-1.0 (`@tanstack/db` 0.15). Expect breaking changes; it
  already lists "removed in 1.0" deprecations.
- **`@neon/realtime-tanstack`** — official TanStack DB integration
  (`realtimeCollectionOptions(...)`). Neon ships a TanStack Start + TanStack DB
  example.

Docs: [launch post](https://neon.com/blog/neon-now-has-realtime),
[how it works](https://neon.com/docs/realtime/how-it-works),
[TanStack example](https://neon.com/docs/realtime/examples/tanstack),
[TanStack DB docs](https://tanstack.com/db/latest/docs).

Re-check both before starting; the APIs below may have moved.

## How Neon Realtime works

- Any SQL `SELECT` (joins, aggregates, `GROUP BY`) becomes a live query. A query
  engine reads logical replication on a replica and streams only the changed
  result rows, batched per transaction and tagged with a txid.
- **Auth:** our server builds the query and calls `realtime.seal({query})`,
  which returns a signed, encrypted capability valid for 60 s. The browser
  opens a WebSocket directly to Neon with it. Neon Auth isn't needed — a
  `crewAuth`-gated server fn seals the queries (see `src/server/crewAuth.ts`).
- **Vercel** only does the sealing; no long-lived function. Open subscriptions
  don't keep compute awake, but opening one wakes the DB.
- **Config:** `NEON_REALTIME_SECRET`, `NEON_REALTIME_URL` → Terraform + GSM like
  the other secrets.
- **No Prisma adapter.** Live queries are raw SQL (`rawSql<Row>(sql, params)`) or
  Drizzle/Kysely. Columns match by name, so camelCase fields need
  `AS "camelCase"`. Queries can't use `now()` or `ORDER BY` (sort on the client).

## Today

- `loadBandApplications` (`src/routes/crew.booking.$eventId.tsx`) runs one big
  Prisma `findMany` (~500 applications per season) and `decorateRows` derives `averageRating`,
  `myRating`, raters, tags and the popularity score.
- Every write is a `crewAuth` server fn (`src/server/rateBandApplication.ts`,
  `setBandApplicationStage.ts`, `postBandApplicationComment.ts`,
  `deleteBandApplicationComment.ts`, tag add/remove in
  `crew.booking.$eventId.$applicationId.tsx`) followed by `router.invalidate()`,
  which re-runs both the table loader and the detail modal's heavy loader.
- Optimistic UI is hand-written: `useState`/`useEffect` re-sync in
  `src/components/booking/BandApplicationRating.tsx`, `pendingComments` /
  `deletedCommentIds`, tag diffing. Stage changes have no rollback on error.
- Gap: the table's rating cell updates only your own stars, not the average.

## Design

### Decision: use TanStack DB (not just `@neon/realtime-react`)

- Optimistic writes with automatic rollback; `awaitTxId(txid)` keeps the
  optimistic value until the same change arrives over the stream (no flicker).
  This replaces the hand-written optimistic code above.
- Simple single-table live queries, joined on the client — avoids one huge
  `json_agg` query (ordering/determinism and latency concerns).
- Table and detail modal read the same collections, so a rating in the modal
  shows up in the table immediately and the modal needs no loader for it.
- Swappable backend: components only talk to collections. If Realtime turns out
  flaky, switch to `queryCollectionOptions` (fetch + optimistic, no live sync)
  without touching components.

### Decision: no SSR

The page doesn't need it. Set `ssr: false` on `/crew/booking/$eventId` (the modal
and contact child routes inherit it). That removes:

- `DbClient` per request, `routerWithDbClient`, hydration/dehydration;
- `initialData` seeding — the server fn only seals, it doesn't run the queries;
- sealed tokens in server-rendered HTML;
- the `mounted` workaround in `BookingPage`.

Trade-off: first paint is two round trips (seal call, then the WebSocket
snapshot) instead of one. After that, every update is incremental.

### Live collections (one set per event, eager sync)

| Collection | Contents | Read by |
|---|---|---|
| `applications` | lean table columns + `stageRow/Column`, `contactedByViewerId` | table, modal header, stage picker, contact state |
| `ratings` | `BandApplicationRating` rows for the event, with the rater's `displayName`/`profilePicture` joined in | average / my rating / raters in table and modal |
| `tags` | `BandApplicationTag` rows for the event | tag column, tag filter, modal tag editor, tag suggestions (replaces `listBandApplicationTags` + its react-query cache) |
| `comments` | all comments for the event, with the author's `displayName`/`profilePicture` joined in | modal comment list, "kommentiert" tag / `hasComments` (replaces the `_count`) |

- Comments are **event-wide**, not per application: a per-application query
  would need a new seal (server-fn call) on every modal open / arrow-key step.
- **Never `SELECT *` on `Viewer`** — it has `slackToken`. Every sealed query is
  hand-written SQL; select columns explicitly.
- Names and avatars are joined into `ratings` and `comments` rather than
  synced as a separate `viewers` collection, so they always arrive together
  with the row that needs them.
- All four are sealed in **one** `crewAuth` server fn (`sealBookingQueries`)
  and share one WebSocket.

### Stays as ordinary loaders

- Application detail fields (`description`, contact info, demo embed, links,
  `repertoire`, …) — large, modal-only, barely change. The modal loader shrinks
  to just these plus the timeline.
- History timeline (`BandApplication` + `BandPlaying` across years, matched with
  `normalizeBandName`) — historical, fuzzy-matched in JS.
- Last year's lineup → `playedLastYear` — static.
- Contact dialog data (event dates, stages), `GOOGLE_MAPS_API_KEY`.

### Route / loader shape

1. Collections defined at module level, keyed by event
   (`applications:${eventId}`). Browser-only, so no per-request instances;
   switching users is a full page load.
2. The loader (runs in the browser) calls `sealBookingQueries`, creates or
   reuses the collections, and awaits `collection.preload()` so the pending UI
   covers the first snapshot. Renewal goes through the same server fn
   (`refreshQuery`).
3. `myRating` needs the current viewer id on the client — take it from the
   `/crew` loader data (`useLoaderData({from: '/crew'})`) and derive it from
   `ratings`.
4. Client-side join replaces `decorateRows`; the output feeds TanStack Table +
   Virtual unchanged.

### Writes

Each mutation becomes a collection operation whose handler (`onUpdate` /
`onInsert` / `onDelete`) calls the existing server fn, which now returns the
txid. The txid **must be read in the same transaction** as the write, or
`awaitTxId` hangs until timeout:

```ts
prismaClient.$transaction(async (tx) => {
  await tx.bandApplicationRating.upsert(...);
  const [{txid}] = await tx.$queryRaw<{txid: string}[]>`
    SELECT pg_current_xact_id()::text AS txid`;
  return txid;
});
```

Applies to ratings, comments (add/delete), tags (add/remove), stage and contact.
`sendBandContactEmail` (`crew.booking.$eventId.$applicationId.contact.tsx`)
stays a plain server call; its effect reaches everyone via the stream.
Background enrichment (Spotify, Instagram, image, distance tasks) and new public
applications also show up live for free. `router.invalidate()` should be needed
almost nowhere in the booking flow afterwards.

## Risks / open questions

1. **Production DB.** Realtime needs logical replication on our only database
   (local `.env` points at prod too). On Neon that typically restarts compute and
   can't be turned off; the docs don't say whether `neon realtime enable` does it
   for you. → Do all work on a Neon branch with Realtime enabled first.
2. **Seal renewal vs Vercel CPU.** Sealed queries expire after 60 s. Unclear
   whether `refreshQuery` fires only on (re)subscribe or every minute per open
   tab. Every minute per tab means a steady stream of server-fn invocations,
   and cold starts already dominate our Hobby CPU budget. **Check this first.**
3. **Beta churn** in both libraries.
4. **Raw SQL reads** lose Prisma's generated types; keep row types next to the
   queries.
5. **Terraform-managed project.** Docs lean on `neon.ts` / `neon deploy`; nothing
   says an existing Terraform-managed project won't work, but it's unconfirmed.
6. No RLS, latency numbers or subscriber limits published yet (limits don't
   matter for a handful of crew members).
7. TanStack DB + Table + Virtual together is undocumented; ~500 applications plus ~2000 ratings per season, with eager
   sync and client-side sort/filter should be fine.

## Plan

1. **Spike (time-boxed), on a Neon branch:** make only **ratings** live — one
   `ratings` collection, `rateBandApplication` returning a txid, rest of the page
   unchanged. Answer risk 2 (renewal frequency) and confirm the Prisma
   `$transaction` + txid pattern and the Terraform setup.
2. **Go/no-go.** If Realtime disappoints, keep TanStack DB with
   `queryCollectionOptions` — the optimistic-update work still pays off.
3. **Migrate the rest:** `ssr: false`, the other four collections, all writes as
   collection mutations, shrink the modal loader, drop the hand-written
   optimistic state and the `mounted` workaround, remove `router.invalidate()`
   from the booking flow.
4. **Enable on production** once it's been stable on the branch.
