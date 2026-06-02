# GCP infrastructure & secrets

This directory plus `tools/sync-env.js` manages everything on the GCP side
of the website — Cloud Tasks queue, Cloud Scheduler jobs, Pub/Sub
subscription, service account + key, three Google API keys (Maps server,
Maps browser, Sheets), Cloud Monitoring (uptime + alert policies) — and
the secrets pipeline that feeds env vars into the running app.

Task handlers live in `src/routes/api.tasks.*.ts` and
`src/server/routes/tasks.*.ts`.

## How it fits together

Everything the app reads from `process.env` either lives in Secret Manager
(real secrets + a few terraform-managed values mirrored to SM) or is
hardcoded static config in `tools/sync-env.js`.

```
   Secret Manager  ───┐
                      ▼
   (gcloud / SDK)   yarn sync:env  ─→ .env (gitignored)
                      │             ─→ src/utils/env.server.ts (typed, committed)
                      └─(with --vercel)─→ Vercel
```

No terraform state involvement, so the same command runs locally (against
ADC) and in GitHub Actions (against a service-account key).

## How the auth works (for running tasks)

Cloud Scheduler, Cloud Tasks, and Pub/Sub push subscriptions all attach an
**OIDC token** to their outbound HTTP requests. The token is a JWT signed
by Google as the `tasks-invoker` service account this Terraform creates.
The Vercel middleware (`gcpAuth(audience)`) verifies the signature against
Google's public keys and checks that the `email` claim matches our SA and
the `aud` claim matches the per-route audience. No shared secret to rotate.

## Prerequisites

- `gcloud` authenticated:
  ```sh
  gcloud auth application-default login
  gcloud config set project gmail-reminder-api
  ```
- Terraform ≥ 1.6 (`brew install hashicorp/tap/terraform`).
- `yarn install` from the repo root.
- For pushing to Vercel: `yarn vercel login` once.

## First-time setup (new machine)

```sh
yarn sync:env
```

That writes:
- `.env` (gitignored) — populated from Secret Manager
- `src/utils/env.server.ts` (committed) — typed accessor module

After that `yarn dev` works. Nothing is copied from anywhere by hand.

## Apply infrastructure changes

```sh
cd terraform
GITHUB_TOKEN=$(awk '/oauth_token:/ {print $2}' ~/.config/gh/hosts.yml) \
  terraform apply
```

The `GITHUB_TOKEN` is needed so terraform can keep the `GCP_SA_KEY` GH
Actions secret in sync with the `ci-secret-pusher` service account key.
(On modern `gh`: `GITHUB_TOKEN=$(gh auth token) terraform apply`.)

Project ID, region, and site URL are hardcoded in the `locals` block at
the top of `main.tf` — edit there if they need to change. **Also update
`STATIC_ENV_VARS` in `tools/sync-env.js`** since those values are
duplicated there for the no-terraform sync path.

## Secrets workflow

### Adding a new secret

1. **Create the secret in Secret Manager**:
   ```sh
   echo -n "the-value" | gcloud secrets create NEW_SECRET --data-file=- \
     --project=gmail-reminder-api
   ```

2. **Add the name to `MANAGED_SECRETS`** in `tools/sync-env.js`.

3. **Sync + push**:
   ```sh
   yarn sync:env --vercel
   ```

4. **Use it in code** (typed):
   ```ts
   import {env} from '@/utils/env.server';
   doSomething(env.NEW_SECRET);
   ```

### Rotating an existing secret

```sh
echo -n "new-value" | gcloud secrets versions add NEW_SECRET --data-file=- \
  --project=gmail-reminder-api
yarn sync:env --vercel
```

Always reads `latest` — no other changes needed.

### Adding a non-secret env var

Non-secret static values (project id, site url, etc.) live in
`STATIC_ENV_VARS` at the top of `tools/sync-env.js`. Add an entry and run
`yarn sync:env --vercel`.

### Push existing values to Vercel (no SM changes)

GitHub Actions does this automatically:

- **On push to `main`** if `tools/sync-env.js` or
  `.github/workflows/sync-env.yml` changed — see
  [`.github/workflows/sync-env.yml`](../.github/workflows/sync-env.yml).
- **On manual trigger** — open the workflow in the Actions tab and click
  "Run workflow". Use this after rotating a secret in Secret Manager
  (which is invisible to git, so no auto-trigger).

Or run locally:

```sh
yarn sync:env --vercel
```

Idempotent either way — re-running just refreshes existing entries.
**Preview** deployments are skipped: Vercel CLI 50.x rejects the
non-interactive "all preview branches" add. If you need a value on
preview, add it via `vercel env add NAME preview <branch>` manually.

### How the GH Actions workflow auths to GCP

`deployment.tf` provisions a dedicated `ci-secret-pusher` service
account with `roles/secretmanager.secretAccessor` — narrow enough that
its JSON key only reads secrets, never writes anything. Terraform
pushes the key into the GH repo as the `GCP_SA_KEY` Actions secret via
the `integrations/github` provider, so `terraform apply` keeps the GH
secret in sync if the key ever rotates.

### What's committed vs. not

| File | Committed? |
|---|---|
| `terraform/*.tf`, `terraform/.terraform.lock.hcl` | yes |
| `terraform/terraform.tfstate` | **no** — gitignored, lives on your machine |
| `tools/sync-env.js` | yes |
| `src/utils/env.server.ts` | yes — generated, but committed for the typed access surface |
| `.env` | **no** — gitignored, regenerate with `yarn sync:env` |

## Smoke test (after a deploy)

1. **Cron task**: GCP Console → Cloud Scheduler → `gmail-watch-refresh`
   → "Run now". Cloud Scheduler logs should show HTTP 204 within a few
   seconds.
2. **Auth gate**:
   ```sh
   curl -X POST https://www.kulturspektakel.de/api/tasks/gmail-watch-refresh
   ```
   → `401 Unauthorized` (no OIDC token).
3. **End-to-end**: send an email to a watched inbox
   (`booking@`/`info@`/`lager@kulturspektakel.de`) — within seconds a
   "Neue E-Mail" Slack notification should land in the matching channel.

## Adding a new scheduled (cron) task

1. Add a handler `src/server/routes/tasks.<name>.ts` and a route file
   `src/routes/api.tasks.<name>.ts` using `gcpAuth('<name>')`.
2. Add a `google_cloud_scheduler_job` block in `production.tf` — copy
   `gmail_watch_refresh`, change `name`, `schedule`, `uri`, and the
   `audience` to match the route.
3. `terraform apply`.

## Adding a new ad-hoc (Cloud Tasks) task

1. Add a handler + route the same way, plus a new overload in
   `src/utils/enqueueGcpTask.server.ts`.
2. No Terraform change needed — they all share the `default` queue.

## File layout

- `main.tf` — providers, backend, locals, API enablement (just the project's
  shared bits).
- `production.tf` — runtime infra: SA, queue, scheduler, pubsub sub, API
  keys, Cloud Monitoring, and the SM mirrors for the API keys + SA key.
- `deployment.tf` — CI plumbing: `ci-secret-pusher` SA + key + IAM +
  the `github_actions_secret` that wires it into the GH repo.
