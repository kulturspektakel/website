# CrewCard holders: implementation plan

Moves CrewCards from "one row per chip, holder fields on the card" to a
holder-centric model:

- A person (`CrewCardHolder`, identified by a `viewerId` **or** a `nickname`)
  can have at most one live physical card and one live wallet pass, either or
  both.
- Every card has a holder. Enrolled-but-unassigned physical chips are not cards
  but `CrewCardEnrollment`s and stay anonymous (usable, unprivileged) until
  their `validUntil`.
- A `CrewCard` row is one issuance of a chip to a holder, never deleted, so the
  rows are the history of who had which card. Physical chips are reused across
  rows.
- `privileged` lives on the holder (applies to all their cards). Suspension
  lives on the card (lost card, replaced card); issuing a new card is how a
  holder gets going again.
- Badges and orders are computed per holder over all their cards, so a new
  card keeps them.
- No event link: `validUntil` is the only time dimension.
- External interfaces are unchanged: device protobufs, NFC payload URLs, the
  PassKit web service and pass serials all keep using the same 7-byte id (the `serial`).

## Schema

```
CrewCardHolder
  id               uuid PK default gen_random_uuid()
  viewerId         text FK Viewer (on update cascade, on delete restrict) UNIQUE
  nickname         citext UNIQUE
  privileged       bool not null default false
  pageToken        text not null UNIQUE      -- random, rotatable; holder page URL
  createdAt        timestamptz not null default now
  CHECK num_nonnulls(viewerId, nickname) = 1
  CHECK NOT privileged OR viewerId IS NOT NULL   -- Bonbude follows #bonbude: Slack users only

CrewCard
  id               uuid PK default gen_random_uuid()
  serial           bytea not null            -- 7-byte id the devices read: NFC UID or A1:… wallet id (= PassKit serialNumber)
  cardType         CrewCardType not null
  holderId         uuid not null FK CrewCardHolder (on delete restrict)
  validUntil       timestamptz not null
  enrolledAt       timestamptz not null      -- start of the order window
  reenrolledAt     timestamptz               -- last re-enrollment of the chip while live
  issuedAt         timestamptz not null default now
  suspendedAt      timestamptz
  suspendedReason  CrewCardSuspendedReason   -- 'lost' | 'replaced' | 'reassigned'
  walletAuthToken, passUpdatedAt, walletPass  (unchanged)
  UNIQUE (holderId, cardType) WHERE suspendedAt IS NULL
  UNIQUE (serial)             WHERE suspendedAt IS NULL
  INDEX  (serial, enrolledAt)
  CHECK  (suspendedAt IS NULL) = (suspendedReason IS NULL)
  CHECK  cardType = 'PHYSICAL' OR walletAuthToken IS NOT NULL

CrewCardEnrollment
  serial           bytea PK
  validUntil       timestamptz not null
  enrolledAt       timestamptz not null
  deviceId         text FK Device (on delete set null)

Order
  crewCardId → crewCardSerial   bytea, no FK; INDEX (crewCardSerial, createdAt)

WalletPassRegistration
  crewCardId            bytea → uuid FK CrewCard(id) (on delete cascade)
```

- `WalletPassFields.eventId` stays (the festival the pass counts for), derived
  as today from `nextKulturspektakel(enrolledAt)`.
- `src/utils/enums.ts`: add `CrewCardSuspendedReason`; pgEnum in `schema.ts`.
- `relations.ts`: holder ↔ viewer, holder → cards, card → registrations. The
  `order.crewCard` relation goes away (orders are matched by chip + time
  window, see below).
- `'reassigned'` covers fixing a wrong assignment in Slack (same chip, other
  person); it is not a block.

### Derived rules (one place: `src/server/crewCards.server.ts`)

- **Live card**: `suspendedAt IS NULL`.
- **Card window** (which orders belong to a card): chip matches and
  `enrolledAt <= order.createdAt < windowEnd`, where `windowEnd` is the
  `enrolledAt` of the chip's next `CrewCard` row or of a newer
  `CrewCardEnrollment` (`lead()` over the chip ordered by `enrolledAt`), else
  ∞. Suspension does **not** end the window: orders after a card is suspended
  (e.g. before the devices picked up the new list) still count to the card and
  its holder. A chip only changes hands through a reassignment or a new
  assignment after re-enrollment, so that's where the window ends. Wallet
  serials are never reused, so their windows are open-ended. A reassignment
  starts the new card at `coalesce(reenrolledAt, enrolledAt)` of the old one:
  right after an issuance (fixing a wrong assignment) the wrong holder's window
  becomes empty and all orders move to the right one; after a re-enrollment
  the old holder keeps everything up to it.
- **Holder's orders for an event**: union of their cards' windows, within the
  event's dates.
- **Device `suspendedCrewCards`**: serials with no live card whose newest
  `CrewCard` (by `issuedAt`) has reason `lost` or `replaced`, and no
  `CrewCardEnrollment` newer than that `suspendedAt` (a replaced chip that was
  re-enrolled must work again).
- **Device `privilegeTokens`**: serials of live cards whose holder is privileged.

## Migration (one hand-written SQL migration)

Local `.env` points at production, and running the migration there directly is
fine: no event is ongoing, so downtime of CrewCard features is acceptable. Take
a Neon snapshot (or branch) right before, as the rollback point.

1. Update `schema.ts`/`relations.ts`, run `yarn db:generate --custom` for an
   empty migration + snapshot, write the SQL by hand. Afterwards
   `yarn db:generate` must report no changes (snapshot matches SQL).
2. SQL, in one transaction:
   1. Create enum, `CrewCardHolder`, `CrewCardEnrollment`.
   2. `ALTER TABLE "CrewCard" RENAME TO "CrewCardLegacy"`.
   3. Holders: one per distinct `viewerId` / `nickname` on legacy rows
      (nicknames merge case-insensitively via citext).
      `privileged = bool_or(privileged AND NOT suspended AND validUntil > now())`,
      `pageToken` random.
   4. Create the new `CrewCard` (without the partial unique indexes yet) and
      copy every legacy row with a holder: `serial = id`, `issuedAt =
      enrolledAt`, suspended rows → `suspendedAt = now(), reason 'replaced'`,
      wallet columns copied.
   5. Duplicates: per (holder, cardType) keep the newest live row, suspend the
      rest as `replaced`. Same for per chip. Then create the partial unique
      indexes.
   6. Enrollments: legacy rows without a holder, not suspended,
      `validUntil > now()`. (Placeholder rows from `insertOrder` have
      `validUntil` = their insert time, so they drop out.)
   7. `Order`: drop `Order_crewCardId_fkey`, rename column to `crewCardSerial`, add
      index.
      Migrated physical cards' `enrolledAt` (window start) moves back to the
      chip's first order: the old model moved `enrolledAt` forward on every
      re-enrollment but showed the holder all of the chip's orders (dry run:
      without this 538 orders had no card, with it 20, all on expired chips
      that never had a holder).
   8. `WalletPassRegistration`: add uuid column, backfill by joining
      `serial` (wallet serials are unique), drop old column, recreate PK
      `(deviceLibraryIdentifier, crewCardId)`, FK and index.
   9. Drop `CrewCardLegacy`.
3. After running it, check counts (holders, live cards per type, device
   lists before vs after: the set of suspended and privileged serials should
   be equal or explainably smaller).

## Code changes

### 1. Core: `src/server/crewCards.server.ts`

Replace `assignCrewCardToHolder` with:

- `findOrCreateHolder(tx, {viewerId} | {nickname})`.
- `issueCrewCard({holder, serial, cardType, validUntil, enrolledAt,
  walletAuthToken?})`, in one transaction: suspend the holder's live card of
  that type (`replaced`), suspend a live card on the same chip
  (`reassigned`), insert, delete the chip's `CrewCardEnrollment`. Returns the
  card and what was suspended (for the Slack messages). Afterwards, as today,
  `grantBonbudePrivilege` if the holder is in #bonbude.
- `cardForPayload(serial, validUntil)`: the issuance matching serial **and**
  `validUntil` (so an old payload of a reused chip never resolves to its new
  holder). A renewal rewrites the chip's payload and the row's `validUntil`, so
  a stale bookmark of the old payload shows "nicht mehr aktiv"; acceptable.
- `renewCrewCard(serial, validUntil, enrolledAt)`: re-enrollment of a chip
  with a live card keeps the row and holder: sets `validUntil` and
  `reenrolledAt`, leaves `enrolledAt` alone (so earlier orders stay in the
  window).
- `holderOrders(holderId, event)`: the card-window query above.
- `deviceCardLists()`: the two device lists.

### 2. Device API: `src/server/kultcash.ts`

- Enrollment upload:
  - chip has a live card → `renewCrewCard` (same row, same holder, privilege
    unchanged); no `CrewCardEnrollment`.
  - otherwise → upsert `CrewCardEnrollment` (anonymous until assigned).
  - enqueue `crew-card-enrolled` in both cases, with whether it was renewed.
- `insertOrder`: no more placeholder `CrewCard`; write `Order.crewCardSerial`.
- Order task enqueue: whenever `crewCardSerial` is set (the task resolves the holder).
- `handleLists`: use `deviceCardLists()`.

### 3. Privileges: `src/server/crewCardPrivileges.server.ts`

`grant`/`revoke`/`reconcile` update `CrewCardHolder.privileged` (filtered on
the current value, so redundant events stay zero-row writes) and refresh the
live wallet cards of the changed holders. The validity/suspension filters and
the "expired privileged card" caveat disappear: devices only get privileged
serials of live cards.

### 4. Slack

- `slack/crewCardEnrollment.ts` (`assignCrewCard`): read `validUntil` /
  `enrolledAt` from the `CrewCardEnrollment`; if there is none but a live card
  on the chip, it's a reassignment (`validUntil` from that card, `enrolledAt`
  = its `coalesce(reenrolledAt, enrolledAt)`). Assigning to the card's current
  holder is a no-op. Then `issueCrewCard`. Message texts unchanged.
- `slack/crewCard.ts` (`/crewcard`):
  - Caller has a live, unexpired wallet card (`validUntil > now`): don't
    issue, just reply with a fresh download link for it (new phone, deleted
    pass). Nothing is suspended.
  - Otherwise (none, or only an expired one): `issueCrewCard` with a new
    wallet serial (an expired live card is suspended as `replaced`), then
    reply with a download link.
  - The link is `https://www.kulturspektakel.de/crewcard/<pageToken>?pass=<downloadToken>`
    (see Wallet below), no longer the card payload link with `?wallet=apple`.
  - A lost wallet card is suspended by hand (below); `/crewcard` then finds
    no live card and issues a new one.
- `tasks/crew-card-enrolled.ts`: renewed → "CrewCard `…` für <holder> bis …
  verlängert" with an "Andere Person zuordnen" button (same modal → the
  reassignment path); otherwise the message as today.
- Lost cards are suspended by hand in the database, no Slack action. One
  statement so the holder page link is rotated with it:
  ```sql
  WITH c AS (
    UPDATE "CrewCard" SET "suspendedAt" = now(), "suspendedReason" = 'lost'
    WHERE serial = '\x…' AND "suspendedAt" IS NULL
    RETURNING "holderId")
  UPDATE "CrewCardHolder" SET "pageToken" = replace(gen_random_uuid()::text, '-', '')
  WHERE id IN (SELECT "holderId" FROM c);
  ```

### 5. Wallet

- **Pass download by short-lived token**, decoupled from the card's permanent
  payload and from `enrolledAt`:
  - `downloadToken` = `CrewCard.id` + `expiresAt` (now + 5 min), HMAC-SHA256
    signed with the existing `CONTACTLESS_SALT` as key, with a fixed context
    prefix (e.g. `crew-card-pass-download:`) in the signed data so a token can
    never be confused with a card payload signature, base64url. Stateless, no column. Helpers `signPassDownloadToken` /
    `verifyPassDownloadToken` in a server-only util.
  - Not single-use: a cancelled add-to-Wallet sheet or a repeated Safari
    request would burn it; the 5-minute expiry is the sharing protection.
  - `api.crewcard.wallet.apple.$payload.ts` → `…$token.ts`: verify the token,
    then serve the pass if the card is a live `APPLE_WALLET` card; otherwise
    redirect to the holder page (or `/` if the token doesn't verify).
    `isWithinWalletDownloadWindow` / `WALLET_DOWNLOAD_WINDOW_MS` in
    `src/utils/walletPass.ts` are replaced by the token expiry.
  - The download is still started by the page, never linked to directly:
    Slack unfurls links, and the unfurler doesn't run the page's JS.
- `sharingProhibited: true` was already set by `crewPassJson`
  (`appleWallet/pass.server.ts`), so Wallet doesn't offer to share the pass.
- The pass's "card page" action keeps the payload link
  (`kult.cash/$c/<payload>`); it only ever opens the card/holder page.
- `appleWalletWebService.ts`: serial → card by `serial` + `APPLE_WALLET`;
  registrations by `CrewCard.id`.
- `appleWallet/push.server.ts`, `crewCardPass.server.ts`:
  `refreshWalletPasses` takes `CrewCard.id`s; add
  `refreshHolderWalletPass(holderId)`. Pass fields come from the holder:
  name, `privileged`, badges and `bookingsTotal` over `holderOrders` (holder
  total for the pass's festival, so it agrees with the badges).

### 6. Orders and badges

- `cardUtils.server.ts`: `queryCrewCard` becomes `queryHolder(holderId,
  event)` returning holder, viewer, live cards and `holderOrders`.
- `tasks/crew-card-order.ts`: resolve the order's card by window → holder;
  before/after badge diff over the holder's orders (otherwise a new card
  re-announces every badge); refresh the holder's live wallet pass (also after
  physical-card orders); DM `holder.viewerId`.
- Orders on an anonymous chip: no holder yet, task does nothing. They count
  once the chip is assigned (window starts at `enrolledAt`).

### 7. Pages

- New `src/routes/_main.crewcard.$token.tsx` (not under `/crew/*`, which is
  Directus-gated): the holder page. Holder name/avatar, live cards with type
  and status, privilege, activities and badges from `queryHolder`. Handles
  `?badge=` and `?pass=<downloadToken>`: starts the download from
  `/api/crewcard/wallet/apple/<downloadToken>` and drops the param from the
  URL right away (as `useWalletPassDownload` does today), with a fallback
  button.
- `_main.card.$hash.crew.tsx`: decode payload → `cardForPayload` →
  - live card: `throw redirect` (temporary) to `/crewcard/<pageToken>`,
    keeping the `badge` search param (`?wallet=` is dropped; it no longer
    exists);
  - suspended card: "Diese CrewCard ist nicht mehr aktiv";
  - no card but enrollment: today's anonymous card page from the chip's orders
    since `enrolledAt`;
  - neither: 404.
- `CardActivities.tsx` `setOrderNotForMe`: authorize by holder `pageToken`
  (the order must be in one of the holder's card windows) instead of a bare
  serial, then refresh the holder's wallet pass. On the anonymous card page,
  keep serial + window.

## Tests (few, targeted; `yarn test`)

- `issueCrewCard`: second card of the same type suspends the first as
  `replaced`; a card of the other type is untouched; holder privilege applies.
- Re-enrollment of a live chip keeps the row and holder and updates
  `validUntil`; of a chip without a live card it creates an enrollment.
- `deviceCardLists`: lost/replaced chip suspended; replaced-then-re-enrolled
  chip not; privileged only for live cards of privileged holders.
- `holderOrders`: orders from an old card of the holder count, including
  orders after its `suspendedAt`; orders of the chip's previous holder (before
  the reassignment) don't.
- Pass download token: a valid token serves the pass; an expired or tampered
  one doesn't.
- `/crewcard` with a live wallet card sends a new link and issues nothing;
  with an expired one it issues a new card.
- Update existing tests touched by the change (`crewCards.server.test.ts`,
  `crewCardPrivileges.server.test.ts`, `crew-card-enrolled.test.ts`,
  `appleWalletPass.test.ts`, the kultcash/wallet e2e tests).

## Rollout

No event is ongoing, so CrewCard features may be down for a while; old code
can't run on the new schema and vice versa, so migration and deploy just go
out back to back:

1. Merge-ready branch. Note the current device lists (suspended / privileged
   serials) for the comparison afterwards.
2. Take a Neon snapshot of production (rollback point).
3. Run `yarn db:migrate` against production, then promote the deploy.
   Anything CrewCard-related (device log uploads, Slack actions, Wallet web
   service) may fail in between; with no event that's acceptable, and Wallet
   retries on its own.
4. Afterwards: counts look right (see Migration step 3),
   `/api/kultcash/lists` matches the noted lists, scan a physical card and
   open a wallet pass (redirect to holder page), run `/crewcard` (new link,
   no new card), assign a test enrollment in Slack, run `/bonbude` once to
   reconcile privileges.

Rollback: the old schema is gone after the migration, so restore the snapshot
from step 2 and redeploy the previous build.
