# GCP-triggered tasks

This directory provisions the Google Cloud side of the task system: a Cloud
Tasks queue, a Cloud Scheduler job (Gmail watch refresh), a Pub/Sub push
subscription (Gmail notifications), a service account, three API keys (Maps
server, Maps browser, Sheets), and Cloud Monitoring (uptime check + alert
policies). The Vercel-side handlers live in `src/routes/api.tasks.*.ts` and
`src/server/routes/tasks.*.ts`.

## How the auth works

Cloud Scheduler, Cloud Tasks, and Pub/Sub push subscriptions all attach an
**OIDC token** to their outbound HTTP requests. The token is a JWT signed by
Google as the `tasks-invoker` service account this Terraform creates. The
Vercel middleware (`gcpAuth(audience)`) verifies the signature against
Google's public keys and checks that the `email` claim matches our service
account and the `aud` claim matches the per-route audience. No shared secret
to rotate.

## Prerequisites

- A GCP project with billing enabled.
- `gcloud` authenticated locally (`gcloud auth application-default login`).
- Terraform ≥ 1.6.

## Apply

```sh
cd terraform
terraform init
terraform apply
```

Project ID, region, and site URL are hardcoded in `main.tf` (`locals` block at
the top) — edit there if any need to change.

## Wire up Vercel

Copy these outputs into the Vercel project's environment variables:

| Vercel env var | Source |
|---|---|
| `GCP_PROJECT_ID` | `gmail-reminder-api` (hardcoded in `main.tf`) |
| `GCP_LOCATION` | `terraform output -raw tasks_queue_location` |
| `GCP_TASKS_QUEUE` | `terraform output -raw tasks_queue_name` |
| `GCP_TASKS_SERVICE_ACCOUNT_EMAIL` | `terraform output -raw tasks_service_account_email` |
| `GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON` | `terraform output -raw tasks_service_account_key_json` |
| `SITE_URL` | `https://www.kulturspektakel.de` (hardcoded in `main.tf`) |

Or run `yarn sync:gcp-env` from the repo root — it writes a managed block in
`.env` from these outputs.

## Smoke test

1. **Scheduled task:** GCP Console → Cloud Scheduler → `gmail-watch-refresh`
   → "Run now". Cloud Scheduler logs should show HTTP 204 within a few
   seconds.
2. **Auth gate:** `curl -X POST https://YOUR_SITE/api/tasks/gmail-watch-refresh`
   (no credentials) → `401 Unauthorized`.
3. **End-to-end:** send an email to a watched inbox (booking/info/lager
   @kulturspektakel.de) — within seconds a "Neue E-Mail" Slack notification
   should land in the matching channel.

## Adding a new scheduled (cron) task

1. Add a handler in `src/server/routes/tasks.<name>.ts` and a route file
   `src/routes/api.tasks.<name>.ts` using `gcpAuth('<name>')`.
2. Add a `google_cloud_scheduler_job` block here — copy
   `gmail_watch_refresh`, change the `name`, `schedule`, `uri`, and the
   `audience` to match the route.
3. `terraform apply`.

## Adding a new ad-hoc (Cloud Tasks) task

1. Add a handler + route the same way, plus a new overload in
   `src/utils/enqueueGcpTask.server.ts`.
2. No Terraform change needed — they all share the `default` queue.
