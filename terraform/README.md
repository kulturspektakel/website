# GCP-triggered tasks

This directory provisions the Google Cloud side of the task system: one Cloud
Tasks queue, one service account, and one demo Cloud Scheduler job. The
Vercel-side handlers live in `src/routes/api.tasks.*.ts` and
`src/utils/gcpAuth.server.ts`.

## How the auth works

Both Cloud Scheduler and Cloud Tasks can be configured to attach an **OIDC
token** to outbound HTTP requests. The token is a JWT signed by Google as the
service account this Terraform creates. The Vercel middleware
(`gcpAuth(audience)`) verifies the signature against Google's public keys and
checks that the `email` claim matches our service account and the `aud` claim
matches the per-route audience. No shared secret to rotate.

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

Then redeploy.

## Smoke test

1. **Scheduled task:** GCP Console → Cloud Scheduler → `heartbeat` → "Run
   now". The Vercel logs should show `[heartbeat] tick at …` within a few
   seconds.
2. **Ad-hoc task:** `curl -X POST https://YOUR_SITE/api/tasks/trigger-demo -H
   'content-type: application/json' -d '{"message":"hi"}'`. Within ~1s the
   Vercel logs should show `[demo task] hi`.
3. **Auth gate:** `curl -X POST https://YOUR_SITE/api/tasks/heartbeat` (no
   credentials) → `401 Unauthorized`.

## Adding a new scheduled task

1. Add a handler to `src/server/routes/tasks.ts` and a route file
   `src/routes/api.tasks.<name>.ts` using `gcpAuth('<name>')`.
2. Add a `google_cloud_scheduler_job` block here — copy `heartbeat`, change
   the `name`, `schedule`, `uri`, and the `audience` to match the route.
3. `terraform apply`.

## Adding a new ad-hoc (Cloud Tasks) task

1. Add a handler + route the same way, plus a new overload in
   `src/utils/enqueueGcpTask.server.ts`.
2. No Terraform change needed — they all share the `default` queue.
