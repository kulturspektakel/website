# Nuclino SSO / SAML consolidation — follow-ups

The Nuclino wiki login (kult.wiki) used to span two repos: this website (the
`/nuclino-sso` page + nonce-request flow) and the legacy `api.kulturspektakel.de`
(the SAML IdP + the Slack approve/reject handler). The SAML IdP has been migrated
into this repo (`src/server/routes/saml.ts`, routes `src/routes/saml.login.ts` and
`src/routes/saml.logout.ts`) and is **live and working in production** (password
and Slack/nonce paths). These follow-ups finish the consolidation and remove the
architectural baggage left over from the split.

## Gotcha: same-origin server routes vs the Navigation API

Moving the IdP onto this domain turned the `/nuclino-sso` password form's action
from a cross-origin URL into a same-origin path (`/saml/login`). The `_main`
layout had a Navigation API handler (`navigation.addEventListener('navigate')`,
for the browser tab spinner) that **intercepted every same-origin navigation** and
resolved only on `router.onResolved` — which never fires for a server-only route
like `/saml/login`. The result: the form POST (and the nonce
`window.location.href = '/saml/login?…'` redirect) became a client-side navigation
to a route with no client component — URL changed, **no network request**, hung
forever. Fixed by removing that interceptor. If a same-origin form/redirect to a
server route ever "hangs with no network request" again, suspect navigation
interception, not the server.

## How the flow works today

1. User hits `/nuclino-sso?SAMLRequest=…` (redirected from Nuclino).
2. Login, two ways:
   - **Slack**: enter email → `createNonceRequest` creates a `NonceRequest`
     (status `Pending`) and enqueues the `create-nonce-request` task, which sends
     a Slack DM with approve/reject buttons. The button click is handled by the
     **legacy api** (`src/routes/slack/interaction.ts`), which flips the
     `NonceRequest` to `Approved`. The page polls `checkNonceRequest`; once
     approved it mints a one-time `Nonce`, returns it, and the browser redirects
     to `/saml/login?…&nonce=…`.
   - **Password**: form POSTs the shared password straight to `/saml/login`.
3. `/saml/login` consumes the nonce (or checks the password) and returns an
   auto-submitting form that POSTs the SAML assertion to Nuclino's ACS.

## Follow-ups (priority order)

### 1. Move the Slack approve/reject handler into this repo — *completes the migration*

The `approve-nonce-request` / `reject-nonce-request` Slack interaction handler
still lives **only** in the legacy api (`src/routes/slack/interaction.ts`,
updates `NonceRequest.status`). Until it moves here, the website's Slack login
path depends on the legacy service still running — so the legacy app can't be
decommissioned.

- Port the `block_actions` handler to a website route (Slack interactivity
  webhook → flip `NonceRequest.status` to `Approved`/`Rejected`).
- Repoint Slack's interactivity Request URL at the new endpoint.

### 2. Collapse `NonceRequest → Nonce` into a single step — *the real architectural win*

The two-table dance (`NonceRequest` for the human-approval workflow, `Nonce` for
the SAML credential) only exists because two separate services handed off through
the database. With everything in one app, `/saml/login` can consume the **approved
`NonceRequest` directly by its id** (the browser already holds that id from
`createNonceRequest`) instead of minting a throwaway `Nonce`.

Removing it deletes:
- the `Nonce` Prisma model (needs a migration),
- the `nonce-invalidate` GCP task (`src/server/routes/tasks.nonce-invalidate.ts`
  + its route),
- a create-then-delete DB round-trip on every login.

`checkNonceRequest` would just confirm approval; `viewerFromNonce` in `saml.ts`
becomes "load the approved, unexpired `NonceRequest` by id and consume it."
Deliberate change — touches the schema, so do it on its own.

### 3. Delete the dead cookie branch — *trivial*

`beforeLoad` in `src/server/routes/nuclino-sso.ts` reads `getCookie('nonce')` and
redirects if present, but **nothing in the repo ever sets a `nonce` cookie**. It's
dead code. Remove it — or, if #2 moves to a cookie-based session, wire it up
properly instead.

### 4. Rotate the copied-forward secrets — *security hygiene*

`SAML_PRIVATE_KEY` and `NUCLINO_ANONYMOUS_PASSWORD` were copied into GSM from the
legacy repo, where they are committed in plaintext (`.env.json`). They should be
rotated so the leaked values are no longer live:
- **`SAML_PRIVATE_KEY`**: generate a fresh RSA keypair, update the public cert
  inlined in `src/server/routes/saml.ts` (`SIGNING_CERT`) and the cert configured
  on Nuclino, then push the new private key to GSM.
- **`NUCLINO_ANONYMOUS_PASSWORD`**: set a new shared wiki password (coordinate
  with crew) and update the GSM secret.

### 5. Decommission the legacy SAML half — *after #1 and Nuclino is repointed*

Once #1 is done and Nuclino's SSO config points at
`https://www.kulturspektakel.de/saml/login`, the following in
`api.kulturspektakel.de` are redundant and can be removed:
- the `/saml/*` route (`src/routes/saml/index.ts`),
- the `createNonceRequest` / `nonceInvalidate` / `nonceRequestInvalidate`
  graphile-worker tasks (this repo uses GCP Cloud Tasks instead),
- the `SAML_PRIVATE_KEY`, `NUCLINO_ANONYMOUS_PASSWORD`, `NUCLINO_TEAM_ID` env vars.

## Operational prerequisites (for going live here)

- **Repoint Nuclino**: SSO URL + IdP Entity ID →
  `https://www.kulturspektakel.de/saml/login`.
- **Secrets in Secret Manager** (read by `scripts/sync-env.js`): create
  `SAML_PRIVATE_KEY` and `NUCLINO_ANONYMOUS_PASSWORD` (both already listed in
  `MANAGED_SECRETS`); `NUCLINO_TEAM_ID` is non-secret static config in the script.
- **Rotate, don't copy**: the legacy repo commits these secrets in plaintext in
  `.env.json`. Prefer regenerating `SAML_PRIVATE_KEY` (+ updating the public cert
  inlined in `saml.ts` and on Nuclino) and rotating the shared password rather
  than carrying the leaked values forward.
