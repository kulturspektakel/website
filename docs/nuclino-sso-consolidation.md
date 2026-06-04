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
     a Slack DM with approve/reject buttons. The button click is handled here by
     `/api/slack/interaction`, which flips the `NonceRequest` to `Approved`. The
     page polls `checkNonceRequest`; once approved it mints a one-time `Nonce`,
     returns it, and the browser redirects to `/api/saml/login?…&nonce=…`.
   - **Password**: form POSTs the shared password straight to `/api/saml/login`.
3. `/api/saml/login` consumes the nonce (or checks the password) and returns an
   auto-submitting form that POSTs the SAML assertion to Nuclino's ACS.

## Follow-ups (priority order)

### 1. Move the Slack approve/reject handler into this repo — ✅ DONE

The `approve-nonce-request` / `reject-nonce-request` handler now lives here at
`src/server/routes/slack/interaction.ts` (route `/api/slack/interaction`),
flipping `NonceRequest.status`. The full inbound Slack surface (interaction,
`/2fa`, events, `/mailingliste`, `/owntracks`, `/nuclino`/token) was migrated
too. Remaining: repoint the Slack App Request URLs to `/api/slack/*` (cutover).

### 2. Collapse `NonceRequest → Nonce` into a single step — ❌ obsolete, do NOT do

This assumed `Nonce` was throwaway baggage from the split. It isn't: the
`/nuclino` one-click flow (`src/server/routes/slack/token.ts`) mints a `Nonce`
**directly** (no `NonceRequest`) and carries it via the `nonce` cookie. So
`Nonce` is the shared one-time credential consumed at `/api/saml/login` by both
the Slack-approval flow and the `/nuclino` flow — deleting the model would break
`/nuclino`. Keep the two-table design.

### 3. Delete the "dead" cookie branch — ✅ resolved (now live, keep it)

`beforeLoad` in `nuclino-sso.ts` reads `getCookie('nonce')` — and that cookie is
now **set** by `GET /api/slack/token` (the `/nuclino` flow). The branch is live
and correct; do not remove it.

### 4. Rotate the copied-forward secrets — *security hygiene*

`SAML_PRIVATE_KEY` and `NUCLINO_ANONYMOUS_PASSWORD` were copied into GSM from the
legacy repo, where they are committed in plaintext (`.env.json`). They should be
rotated so the leaked values are no longer live:
- **`SAML_PRIVATE_KEY`**: generate a fresh RSA keypair, update the public cert
  inlined in `src/server/routes/saml.ts` (`SIGNING_CERT`) and the cert configured
  on Nuclino, then push the new private key to GSM.
- **`NUCLINO_ANONYMOUS_PASSWORD`**: set a new shared wiki password (coordinate
  with crew) and update the GSM secret.

### 5. Decommission the legacy app — *unblocked once cutover completes*

#1 is done and the whole Slack/SAML/OwnTracks/Nuclino surface is migrated, so
once the **cutover** finishes (Slack App Request URLs → `/api/slack/*`; Nuclino
IdP Entity ID → `https://www.kulturspektakel.de/api/saml/login`, SSO URL stays
`…/nuclino-sso`; `/owntracks` device configs re-issued), the legacy
`api.kulturspektakel.de` no longer receives any traffic for these features and
can be retired. Redundant there: the `/saml/*` + `/slack/*` + `/owntracks`
routes, the Slack/nonce graphile-worker tasks, the `nuclinoUpdateMessage` cron,
and the `SAML_PRIVATE_KEY` / `NUCLINO_*` / `JWT_SECRET` env vars. (Edits in the
*other* repo — not this one.)

## Operational prerequisites (for going live here)

- **Repoint Nuclino**: IdP Entity ID →
  `https://www.kulturspektakel.de/api/saml/login`; SSO URL → `…/nuclino-sso`
  (the login page — unchanged when the IdP routes moved under `/api`).
- **Repoint the Slack App** Request URLs → `/api/slack/*` (interaction, events,
  and the `/2fa` `/mailingliste` `/owntracks` `/nuclino` slash commands).
- **Secrets in Secret Manager** (read by `scripts/sync-env.js`'s `ENV_VARS`
  manifest): `SAML_PRIVATE_KEY`, `NUCLINO_ANONYMOUS_PASSWORD`, `NUCLINO_TEAM_ID`,
  `NUCLINO_API_KEY`, `NUCLINO_WORKSPACE_ID`, `JWT_SECRET` — all created in GSM.
- **Rotate, don't copy**: the legacy repo commits these secrets in plaintext in
  `.env.json`. Prefer regenerating `SAML_PRIVATE_KEY` (+ updating the public cert
  inlined in `saml.ts` and on Nuclino) and rotating the shared password rather
  than carrying the leaked values forward.
