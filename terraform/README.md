# GCP infrastructure & secrets

Terraform managing everything on GCP for the website (Cloud Tasks queue,
Cloud Scheduler jobs, Pub/Sub push subscription, Maps/Sheets API keys,
service accounts, Cloud Monitoring), plus `scripts/sync-env.js`, which
generates the app's `.env` (and pushes it to Vercel) from a single manifest
of env vars sourced from terraform outputs + Secret Manager.

Task handlers live in `src/routes/api.tasks.*.ts` and
`src/server/routes/tasks.*.ts`.

## File layout

| File                  | What's in it                                                                                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main.tf`             | Providers, locals (`project_id`, `region`, `site_url`), API enablement                                                                                                                    |
| `production.tf`       | Runtime infra: `tasks-invoker` SA, queue, scheduler, Pub/Sub, API keys, monitoring; plus the `env_vars` output (non-secret config for the app)                                            |
| `deployment.tf`       | CI plumbing: `ci-secret-pusher` SA + key, plus a `ci_secret_pusher_key` output used to refresh the `GCP_SA_KEY` GH Actions secret on rotation                                             |
| `scripts/sync-env.js` | The `ENV_VARS` manifest (every var + its source) → reads the `env_vars` terraform output + Secret Manager → writes `.env` + `types/env.d.ts` (types `process.env`) + optional Vercel push |

## Monitoring

Terraform owns the `www.kulturspektakel.de` uptime check and its alert, plus
the `Task failures` alert. Console-managed duplicates of all three (created
2026-06-03, alongside the terraform-managed originals) were deleted on
2026-08-10 — they were notifying Slack twice per event. Don't recreate monitors
in the console; add them to `production.tf`.

The uptime alert deliberately fires on a _sustained_ drop in success rate
rather than on failed probes: every deploy cold-starts the SSR function per
edge region, and the first request into a region routinely exceeds the check's
20s timeout. Replayed over 30 days, the worst deploy scores 0.722 against the
0.6 threshold, while a real outage (HTTP 402, spending limit, 2026-07-27) sits
at 0. Retune with the `alignment_period` / `threshold_value` pair, not by
loosening the check timeout.

The `api.kulturspektakel.de` check + alert are still console-managed; retire
them with the legacy API.

The `Task failures` alert is log-based, so it only works if the queues actually
write logs — hence `stackdriver_logging_config { sampling_ratio = 1.0 }` on
both `google_cloud_tasks_queue` resources. Sampling defaults to `0.0`, and
until 2026-08-24 it was unset: Cloud Tasks emitted nothing, so the
`resource.type="cloud_tasks_queue"` half of that policy's filter could never
match and no Cloud Tasks failure had ever alerted. If you add a queue, set
sampling on it too.

## Sentry alerting (console-managed)

Not Terraform-managed — the `google` provider can't reach Sentry, and adding a
second provider for one rule isn't worth it. Documented here so it isn't lost.

`apiErrorBoundary` (`src/server/apiError.server.ts`) is the capture point for
every `/api/*` and task/cron error: it calls `Sentry.captureException` before
swallowing the throw into an HTTP response, so these never reach Sentry's
global request middleware. Capture is confirmed working in production.

Alerting is the gap. On 2026-08-23 the `instagram-follower` task failed all 25
attempts (Instagram began rejecting Node's `fetch` over its `Sec-Fetch-*`
headers). Sentry recorded the events; nothing notified anyone, and GCP couldn't
either — see the queue-logging note above. The rule to keep in place:

- **Trigger on event frequency**, e.g. "an issue is seen more than 5 times in
  1 hour" — not on new-issue (and not only on regression). This is the actual
  2026-08-23 failure mode: the project's rule fired only for _new_ issues, and
  the task's throw site had been grouped into a long-lived issue years earlier,
  so 25 events arrived on an already-open issue and matched nothing. A
  regression trigger would not have helped either — the issue had never been
  resolved, so it never transitioned back to unresolved. Add regression as a
  second trigger for the case where someone does resolve it, but frequency is
  the one that catches a re-break.

  Tune the threshold against the retry schedule, not intuition: the scrapers
  queue backs off 30s → 1h, so a wedged task lands ~7–8 events in the first
  hour and one per hour after that.

- **Action** → the same `Monitoring` Slack channel the GCP alerts use, not
  member email.
- **Do not** filter on `environment`. Neither `instrument.server.ts` nor
  `instrument.client.ts` passes `environment` to `Sentry.init`, so everything
  reports as `production` — and `enabled: import.meta.env.PROD` is true for
  Vercel preview builds as well, so preview errors are indistinguishable from
  real ones. Pass `environment` from `VERCEL_ENV` in both inits before relying
  on any environment filter.

Expect double-notification once both paths work: GCP catches retry exhaustion
and unreachable targets, Sentry catches the exception and stack. That overlap
is intentional.

### Why new-issue alerts don't work for the scraper tasks

The scrapers signal failure by rethrowing the response body from a single site
— `throw new Error(res.body)` on the non-2xx branch. Sentry groups exceptions
by stack trace, not message, so every distinct upstream failure at that line
(policy rejection, rate limit, auth change, unexpected JSON) collapses into one
issue that stays open for years. New-issue alerts therefore fire once, on the
first failure ever, and never again — which is exactly what happened here.

If you want new-issue alerting to be meaningful on these, give the throws
distinguishable fingerprints — either `Sentry.withScope` + `setFingerprint`
keyed on the upstream status, or distinct error subclasses per failure mode, so
"Instagram rejected our headers" and "Instagram rate-limited us" are separate
issues. Until then, prefer the frequency rule above.

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
terraform -chdir=terraform init   # sync:env reads the `env_vars` output
yarn sync:env
```

Writes `.env` (gitignored) + `types/env.d.ts` (committed; types
`process.env`). `yarn dev` works after this.

## Using env vars in code

Read them off `process.env` — `types/env.d.ts` types every declared key, so
typos and missing vars are compile errors.

```ts
new Stripe(process.env.STRIPE_API_KEY); // typed via types/env.d.ts
```

## Adding a new env var

Every variable is declared once in the `ENV_VARS` manifest at the top of
`scripts/sync-env.js`, tagged with its source (`'terraform'` or `'secret'`).
That manifest drives `.env`, the typed accessor, and the Vercel push.

**A secret** — create it in Secret Manager, then declare it:

```sh
echo -n "value" | gcloud secrets create NEW_KEY --data-file=- \
  --project=gmail-reminder-api
# add `NEW_KEY: 'secret',` to ENV_VARS in scripts/sync-env.js
yarn sync:env             # regenerate .env + types/env.d.ts locally
git commit -am "Add NEW_KEY" && git push
```

**Non-secret config** — add it to the `env_vars` output in `production.tf`,
`terraform apply`, then declare `NEW_KEY: 'terraform',` in `ENV_VARS` and
`yarn sync:env`. (`sync-env.js` errors if the manifest and the `env_vars`
output disagree, so the two stay in lockstep.)

The push to main edits `scripts/sync-env.js`, so GH Actions auto-syncs to
Vercel. Once it lands, `env.NEW_KEY` is available in code.

## Rotating a secret

```sh
echo -n "new-value" | gcloud secrets versions add EXISTING_KEY --data-file=- \
  --project=gmail-reminder-api
```

Then in GitHub Actions → **Deploy** → **Run workflow**. (SM changes are
invisible to git, so a push won't pick them up — trigger it manually.)

## Pushing env vars to Vercel

Happens automatically on every push to `main` (the **Deploy** workflow,
`.github/workflows/main.yml`). For manual triggers (after a SM rotation),
use **Run workflow** in the Actions tab.

Run locally with `yarn sync:env --vercel`. Idempotent. Preview deployments
are skipped (Vercel CLI 50.x limitation).

## Applying infrastructure changes

```sh
cd terraform
terraform init   # first time on a machine: pulls remote state from GCS
terraform apply
```

State lives in a versioned GCS bucket (`gs://gmail-reminder-api-tfstate`,
prefix `terraform/state`), configured via the `backend "gcs"` block in
`main.tf`. It is shared across machines with locking, so there is no local
`terraform.tfstate` to sync. `terraform init` reads the backend and pulls
the state; it relies on the same ADC login as the rest of setup.

The non-secret config the app needs (project id, region, site url, queue
names, tasks-invoker SA email) is exposed via the `env_vars` output in
`production.tf`; `sync-env.js` reads it with `terraform output`, so there's
nothing to keep in sync by hand — change a `local` and the env follows after
the next `terraform apply` + `yarn sync:env`.

CI never applies. The `terraform-drift` job in `.github/workflows/main.yml`
runs `terraform plan -refresh=false` on every push to `main` and **fails the
deploy if committed config wasn't applied** — your reminder to run
`terraform apply` locally. It reads only state + data sources (not live
infra), so the `ci-secret-pusher` SA needs just the read-only roles in
`deployment.tf` (`ci_state_reader` + `ci_plan_reader`). It does not block the
app build; the workflow just goes red.

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
