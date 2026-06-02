# GCP infrastructure & secrets

This directory plus `tools/sync-env.js` manages everything on the GCP side
of the website — Cloud Tasks queue, Cloud Scheduler jobs, Pub/Sub
subscription, service account + key, three Google API keys (Maps server,
Maps browser, Sheets), Cloud Monitoring (uptime + alert policies) — and
the secrets pipeline that feeds env vars into the running app.

Task handlers live in `src/routes/api.tasks.*.ts` and
`src/server/routes/tasks.*.ts`.

## How it fits together

The single source of truth for every env var is `local.env_vars` in
`main.tf`. The flow:

```
Secret Manager values ─→ terraform data source ─→ local.env_vars
                                                       │
                                                       ▼
                                            terraform output env_vars
                                                       │
                                                       ▼
                                            yarn sync:env       ─→ .env
                                                       │            (gitignored)
                                                       ├─→ src/utils/env.server.ts
                                                       │            (typed, committed)
                                                       └─(with --vercel)─→ Vercel
```

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
terraform -chdir=terraform init   # one-time per checkout
yarn sync:env
```

That writes:
- `.env` (gitignored) — populated from Secret Manager via terraform outputs
- `src/utils/env.server.ts` (committed) — typed accessor module

After that `yarn dev` works. Nothing is copied from anywhere by hand.

## Apply infrastructure changes

```sh
cd terraform
terraform apply
```

Project ID, region, and site URL are hardcoded in the `locals` block at
the top of `main.tf` — edit there if they need to change.

## Secrets workflow

### Adding a new secret

1. **Create the secret in Secret Manager**:
   ```sh
   echo -n "the-value" | gcloud secrets create NEW_SECRET --data-file=- \
     --project=gmail-reminder-api
   ```

2. **Add the name to `local.managed_secrets`** in `terraform/main.tf`:
   ```hcl
   managed_secrets = toset([
     ...
     "NEW_SECRET",
   ])
   ```

3. **Apply + sync + push**:
   ```sh
   terraform -chdir=terraform apply
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

Terraform data sources always read `latest`, so no `.tf` change needed.

### Adding a non-secret env var

Non-secret values (like `SITE_URL`, `GCP_LOCATION`, or a terraform-managed
resource attribute) go in the literal half of the `local.env_vars` merge:

```hcl
env_vars = merge(
  {
    ...
    NEW_CONFIG_VAR = "static-value-or-${resource.attr}"
  },
  ...
)
```

Then `terraform apply && yarn sync:env --vercel`.

### Push existing values to Vercel (no SM changes)

```sh
yarn sync:env --vercel
```

Idempotent — re-running just refreshes existing entries. **Preview**
deployments are skipped: Vercel CLI 50.x rejects the non-interactive
"all preview branches" add. If you need a value on preview, add it via
`vercel env add NAME preview <branch>` manually.

### What's committed vs. not

| File | Committed? |
|---|---|
| `terraform/*.tf`, `terraform/.terraform.lock.hcl` | yes |
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
2. Add a `google_cloud_scheduler_job` block in `main.tf` — copy
   `gmail_watch_refresh`, change `name`, `schedule`, `uri`, and the
   `audience` to match the route.
3. `terraform apply`.

## Adding a new ad-hoc (Cloud Tasks) task

1. Add a handler + route the same way, plus a new overload in
   `src/utils/enqueueGcpTask.server.ts`.
2. No Terraform change needed — they all share the `default` queue.
