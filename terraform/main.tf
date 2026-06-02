terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

locals {
  project_id = "gmail-reminder-api"
  region     = "europe-west1"
  site_url   = "https://www.kulturspektakel.de"

  # Secrets read from Secret Manager and exposed as Vercel env vars under the
  # same name. Add a new entry here (and create it via `gcloud secrets create`)
  # to make a new secret available to the app via `env.NAME`.
  managed_secret_names = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "CONTACTLESS_SALT",
    "DATABASE_URL",
    "SLACK_BOT_TOKEN",
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
    "STRIPE_API_KEY",
  ]
}

data "google_project" "this" {
  project_id = local.project_id
}

# Single for_each data source for everything in `managed_secret_names`.
# Adding a new secret = add a name to the list above + create it via gcloud.
data "google_secret_manager_secret_version" "managed" {
  for_each = toset(local.managed_secret_names)
  secret   = each.key
}

# Two existing Workspace-SA secrets get *renamed* on the way out, because
# the legacy api uses `GOOGLE_SERVICE_ACCOUNT_*` for the same values that we
# call `GMAIL_SA_*`. Read them separately so we can map the names in
# `local.env_vars` below.
data "google_secret_manager_secret_version" "gmail_sa_email" {
  secret = "GOOGLE_SERVICE_ACCOUNT_EMAIL"
}

data "google_secret_manager_secret_version" "gmail_sa_private_key" {
  secret = "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
}

provider "google" {
  project = local.project_id
  region  = local.region
  # Required so the apikeys.googleapis.com API (which needs a quota project)
  # accepts requests made via user ADC credentials. Harmless for other APIs.
  user_project_override = true
  billing_project       = local.project_id
}

# Enable the APIs we use. `disable_on_destroy = false` keeps a `terraform
# destroy` from breaking other things in the same project that depend on them.
resource "google_project_service" "apis" {
  for_each = toset([
    "apikeys.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudtasks.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "secretmanager.googleapis.com",
  ])
  service            = each.key
  disable_on_destroy = false
}

# Single service account used for both sides of the auth:
#   - Cloud Scheduler / Cloud Tasks sign OIDC tokens *as* this SA when they
#     POST to Vercel; the Vercel `gcpAuth` middleware checks that the token's
#     email matches this SA.
#   - The Vercel app authenticates to the Cloud Tasks API as this SA (via the
#     JSON key below) when it wants to enqueue a task.
resource "google_service_account" "tasks" {
  account_id   = "tasks-invoker"
  display_name = "Tasks invoker (Vercel ↔ Cloud Tasks / Scheduler)"
  depends_on   = [google_project_service.apis]
}

# Lets the SA enqueue tasks into queues in this project.
resource "google_project_iam_member" "tasks_enqueuer" {
  project = local.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.tasks.email}"
}

# Required so that *this* SA can create tasks that attach OIDC tokens minted as
# itself (Cloud Tasks does the minting at delivery time; it needs the creator
# to have actAs on the OIDC SA, which here is the same SA).
resource "google_service_account_iam_member" "tasks_act_as_self" {
  service_account_id = google_service_account.tasks.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.tasks.email}"
}

# Let the Pub/Sub service agent mint OIDC tokens as `tasks-invoker` for push
# subscriptions targeting Vercel (see `google_pubsub_subscription.gmail_notification`).
resource "google_service_account_iam_member" "pubsub_oidc_token_creator" {
  service_account_id = google_service_account.tasks.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.this.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

# JSON key used by the Vercel deployment to authenticate as the SA. Copy the
# `tasks_service_account_key_json` output into the
# `GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON` env var on Vercel.
resource "google_service_account_key" "tasks_key" {
  service_account_id = google_service_account.tasks.name
}

resource "google_cloud_tasks_queue" "default" {
  name       = "default"
  location   = local.region
  depends_on = [google_project_service.apis]
}

# Pub/Sub push subscription for Gmail notifications: every new email in our
# watched inboxes (booking/info/lager) → POST to /api/tasks/gmail-notification.
# The topic itself (`mail-reminder`) and the publisher side (Gmail watch via
# the legacy `gmail-reminder` SA) are pre-existing — we just add this consumer.
#
# Cutover: there's also a legacy pull subscription `api.kulturspektakel.de`
# that delivers the same topic to the legacy api. Delete that one via gcloud
# after this applies, otherwise both systems will react to each email.
resource "google_pubsub_subscription" "gmail_notification" {
  name  = "gmail-notification-vercel"
  topic = "projects/${local.project_id}/topics/mail-reminder"

  ack_deadline_seconds = 60

  push_config {
    push_endpoint = "${local.site_url}/api/tasks/gmail-notification"
    oidc_token {
      service_account_email = google_service_account.tasks.email
      audience              = "gmail-notification"
    }
  }

  depends_on = [
    google_project_service.apis,
    google_service_account_iam_member.pubsub_oidc_token_creator,
  ]
}

# Daily Gmail watch renewal — Gmail watches expire after 7 days, so we ping
# the watch refresh endpoint every 24h to keep them alive.
resource "google_cloud_scheduler_job" "gmail_watch_refresh" {
  name        = "gmail-watch-refresh"
  description = "Renew Gmail Pub/Sub watch for booking/info/lager inboxes."
  schedule    = "0 0 * * *"
  time_zone   = "UTC"
  region      = local.region

  http_target {
    uri         = "${local.site_url}/api/tasks/gmail-watch-refresh"
    http_method = "POST"
    oidc_token {
      service_account_email = google_service_account.tasks.email
      audience              = "gmail-watch-refresh"
    }
  }

  depends_on = [google_project_service.apis]
}

# Single source of truth for everything the app expects in `process.env` /
# `env.X` (see src/utils/env.server.ts, which is auto-generated from this
# map's keys). `tools/sync-env.py` iterates this and writes .env + the typed
# env module + optionally pushes to Vercel.
locals {
  env_vars = merge(
    # Static config + values derived from terraform-managed resources.
    {
      GCP_PROJECT_ID                     = local.project_id
      SITE_URL                           = local.site_url
      GCP_LOCATION                       = google_cloud_tasks_queue.default.location
      GCP_TASKS_QUEUE                    = google_cloud_tasks_queue.default.name
      GCP_TASKS_SERVICE_ACCOUNT_EMAIL    = google_service_account.tasks.email
      GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON = base64decode(google_service_account_key.tasks_key.private_key)
      GOOGLE_MAPS_API_KEY_SERVER         = google_apikeys_key.maps_server.key_string
      GOOGLE_MAPS_API_KEY                = google_apikeys_key.maps_browser.key_string
      GMAIL_SA_EMAIL                     = data.google_secret_manager_secret_version.gmail_sa_email.secret_data
      GMAIL_SA_PRIVATE_KEY               = data.google_secret_manager_secret_version.gmail_sa_private_key.secret_data
    },
    # SM-backed secrets where the env var name == SM secret name.
    {
      for name in local.managed_secret_names :
      name => data.google_secret_manager_secret_version.managed[name].secret_data
    },
  )
}

output "env_vars" {
  description = "All values the app expects in process.env. Iterated by tools/sync-env.py."
  value       = local.env_vars
  sensitive   = true
}

# ---- Google Maps API keys ------------------------------------------------

# Server-side Maps key, shared with the legacy `~/api.kulturspektakel.de`
# project (read from Secret Manager `GOOGLE_MAPS_KEY` there). When the legacy
# project's remaining Maps usage is moved into this codebase, the
# Geocoding/Static-Maps entries can probably be dropped.
#
# Usage on this side: `src/server/components/DistanceWarning.ts` → Distance
# Matrix.
# Usage on the legacy side:
#   - geocoding (`distanceToKult.ts`, `slack/lagerschluessel.ts`)
#   - static maps (`slack/lagerschluessel.ts`)
#   (Sheets moved off this key to `google_apikeys_key.sheets`.)
resource "google_apikeys_key" "maps_server" {
  name         = "f8c81e08-d11f-44e9-b30d-0cffecea382e"
  display_name = "Maps server (Distance Matrix, Geocoding, Static Maps)"

  restrictions {
    api_targets {
      service = "distance-matrix-backend.googleapis.com"
    }
    api_targets {
      service = "geocoding-backend.googleapis.com"
    }
    api_targets {
      service = "static-maps-backend.googleapis.com"
    }
  }

  depends_on = [google_project_service.apis]
}

# Public browser Maps key. Loaded by `@googlemaps/react-wrapper` in
# `src/components/GoogleMaps.tsx` to render maps + markers. Referrer-locked to
# our domain + local dev, and API-locked to just the Maps JS API.
resource "google_apikeys_key" "maps_browser" {
  name         = "27f7d335-7a21-4943-a64f-76dd03d8721b"
  display_name = "Maps browser (JS API)"

  restrictions {
    browser_key_restrictions {
      allowed_referrers = ["*.kulturspektakel.de", "localhost:3000"]
    }
    api_targets {
      service = "maps-backend.googleapis.com"
    }
  }

  depends_on = [google_project_service.apis]
}

# Dedicated key for the Google Sheets API — separate concern from Maps, lives
# on its own key so a Sheets leak doesn't expose Maps quota and vice versa.
# Used today by the legacy `~/api.kulturspektakel.de` project's
# `utils/readGoogleSheet.ts`. Migration steps after this resource is applied:
#   1. `terraform output -raw sheets_key_string` and store as a new secret
#      `GOOGLE_SHEETS_KEY` in Secret Manager.
#   2. Update legacy code to read `GOOGLE_SHEETS_KEY` instead of
#      `GOOGLE_MAPS_KEY` for Sheets calls, deploy.
#   3. Remove `sheets.googleapis.com` from `google_apikeys_key.maps_server`'s
#      `api_targets` (it'll only be carrying Maps APIs after that).
resource "google_apikeys_key" "sheets" {
  name         = "sheets-api"
  display_name = "Sheets API"

  restrictions {
    api_targets {
      service = "sheets.googleapis.com"
    }
  }

  depends_on = [google_project_service.apis]
}

output "sheets_key_string" {
  description = "Sheets API key. Sensitive."
  value       = google_apikeys_key.sheets.key_string
  sensitive   = true
}

# Mirror the Sheets API key into Secret Manager so the legacy
# `~/api.kulturspektakel.de` project can read it the same way it already reads
# `GOOGLE_MAPS_KEY` etc. The value rotates automatically if the key is ever
# regenerated in `google_apikeys_key.sheets`.
resource "google_secret_manager_secret" "sheets_key" {
  secret_id = "GOOGLE_SHEETS_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "sheets_key" {
  secret      = google_secret_manager_secret.sheets_key.id
  secret_data = google_apikeys_key.sheets.key_string
}

# ---- Monitoring ----------------------------------------------------------

# Look up the existing "Monitoring" Slack channel — we don't manage it here
# (the auth token can't be round-tripped through Terraform state) but we want
# the new alerts to fire into the same channel as the other ones in the
# console.
data "google_monitoring_notification_channel" "slack" {
  display_name = "Monitoring"
  type         = "slack"
}

# Replaces the console-managed `www.kulturspektakel.de` uptime check; delete
# the old one in the console after this applies so we don't double up.
resource "google_monitoring_uptime_check_config" "www" {
  display_name = "www.kulturspektakel.de"
  timeout      = "20s"
  period       = "300s"

  http_check {
    path           = "/"
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = local.project_id
      host       = "kulturspektakel.de"
    }
  }

  depends_on = [google_project_service.apis]
}

# Replaces the console-managed `www.kulturspektakel.de uptime failure` alert.
# Fires when more than one check fails within a 20-minute window for 60s.
resource "google_monitoring_alert_policy" "www_uptime" {
  display_name = "www.kulturspektakel.de uptime failure"
  combiner     = "OR"

  conditions {
    display_name = "Failure of uptime check ${google_monitoring_uptime_check_config.www.uptime_check_id}"
    condition_threshold {
      filter          = <<-EOT
        metric.type="monitoring.googleapis.com/uptime_check/check_passed"
        AND metric.label.check_id="${google_monitoring_uptime_check_config.www.uptime_check_id}"
        AND resource.type="uptime_url"
      EOT
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "60s"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "1200s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.*"]
      }
    }
  }

  notification_channels = [data.google_monitoring_notification_channel.slack.name]
}

# Fires when Cloud Tasks or Cloud Scheduler logs an error: retry exhaustion,
# target unreachable, malformed task config, etc. Rate-limited so a runaway
# task doesn't spam Slack — at most one notification every 5 minutes; the
# incident auto-closes after 30 min of no further errors.
resource "google_monitoring_alert_policy" "task_failures" {
  display_name = "Task failures (Cloud Tasks / Scheduler)"
  combiner     = "OR"

  conditions {
    display_name = "Cloud Tasks or Scheduler error log"
    condition_matched_log {
      # Log-matching alert policies can have only one condition (per the GCP
      # API), so the OR is inside the Cloud Logging filter itself.
      filter = "(resource.type=\"cloud_tasks_queue\" OR resource.type=\"cloud_scheduler_job\") AND severity>=ERROR"
    }
  }

  alert_strategy {
    notification_rate_limit {
      period = "300s"
    }
    auto_close = "1800s"
  }

  notification_channels = [data.google_monitoring_notification_channel.slack.name]
}
