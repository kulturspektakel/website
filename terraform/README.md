# GCP infrastructure & secrets

Terraform managing everything on GCP for the website (Cloud Tasks queue,
Cloud Scheduler jobs, Pub/Sub push subscription, Maps/Sheets API keys,
service accounts, Cloud Monitoring), plus the script that syncs Secret
Manager values into `.env` + Vercel.

Task handlers live in `src/routes/api.tasks.*.ts` and
`src/server/routes/tasks.*.ts`.

## File layout

| File | What's in it |
|---|---|
| `main.tf` | Providers, locals (`project_id`, `region`, `site_url`), API enablement |
| `production.tf` | Runtime infra: `tasks-invoker` SA, queue, scheduler, Pub/Sub, API keys, monitoring |
| `deployment.tf` | CI plumbing: `ci-secret-pusher` SA + key + the GH Actions secret that wires it up |
| `tools/sync-env.js` | Reads Secret Manager → writes `.env` + `src/utils/env.server.ts` (typed accessor) + optional Vercel push |

## How auth works (for tasks)

Cloud Scheduler / Cloud Tasks / Pub/Sub push subscriptions attach an OIDC
token signed as the `tasks-invoker` SA. The Vercel middleware
(`gcpAuth(audience)`) verifies the signature, email, and audience. No
shared secrets to rotate.

## Setup (new machine)

```sh
gcloud auth application-default login
gcloud config set project gmail-reminder-api
yarn install
yarn sync:env
```

Writes `.env` (gitignored) + `src/utils/env.server.ts` (committed, typed).
`yarn dev` works after this.

## Using env vars in code

```ts
import {env} from '@/utils/env.server';
new Stripe(env.STRIPE_API_KEY); // typed string, validated at access
```

## Adding a new secret

```sh
echo -n "value" | gcloud secrets create NEW_KEY --data-file=- \
  --project=gmail-reminder-api
# add "NEW_KEY" to MANAGED_SECRETS in tools/sync-env.js
yarn sync:env             # regenerate .env + env.server.ts locally
git commit -am "Add NEW_KEY" && git push
```

The push to main edits `tools/sync-env.js`, so GH Actions auto-syncs to
Vercel. Once it lands, `env.NEW_KEY` is available in code.

## Rotating a secret

```sh
echo -n "new-value" | gcloud secrets versions add EXISTING_KEY --data-file=- \
  --project=gmail-reminder-api
```

Then in GitHub Actions → "sync env to vercel" → **Run workflow**. (SM
changes are invisible to git, so no auto-trigger.)

## Pushing env vars to Vercel

Happens automatically on push to `main` when `tools/sync-env.js` or
`.github/workflows/sync-env.yml` changes. For manual triggers (after a SM
rotation), use **Run workflow** in the Actions tab.

Run locally with `yarn sync:env --vercel`. Idempotent. Preview deployments
are skipped (Vercel CLI 50.x limitation).

## Applying infrastructure changes

```sh
cd terraform
terraform apply
```

State is local (`terraform/terraform.tfstate`, gitignored). When changing
the constants in `local` (project id, region, site url), also update
`STATIC_ENV_VARS` at the top of `tools/sync-env.js` — those values are
duplicated there.

### Rotating the CI service account key

The `GCP_SA_KEY` Actions secret was set up once by terraform but is no
longer managed by it. If you ever rotate the `ci-secret-pusher` SA key:

```sh
terraform -chdir=terraform taint google_service_account_key.ci_secret_pusher
terraform -chdir=terraform apply  # destroys + recreates the key
terraform -chdir=terraform output -raw ci_secret_pusher_key | \
  gh secret set GCP_SA_KEY -R kulturspektakel/website
```

## Adding a new task

**Scheduled (cron)** — handler in `src/server/routes/tasks.<name>.ts` and
route in `src/routes/api.tasks.<name>.ts` using `gcpAuth('<name>')`. Add a
`google_cloud_scheduler_job` block in `production.tf` (copy
`gmail_watch_refresh`, adjust `name` / `schedule` / `uri` / `audience`).
Then `terraform apply`.

**Ad-hoc (Cloud Tasks)** — same handler + route pattern, plus a new
overload in `src/utils/enqueueGcpTask.server.ts`. No terraform change
needed; everything shares the `default` queue.

## Smoke test

- `gcloud scheduler jobs run gmail-watch-refresh --location=europe-west1`
  → should return HTTP 204 within seconds.
- `curl -X POST https://www.kulturspektakel.de/api/tasks/gmail-watch-refresh`
  → `401` (no OIDC token).
- Send an email to `booking@` / `info@` / `lager@kulturspektakel.de`
  → "Neue E-Mail" Slack message in the matching channel within seconds.
