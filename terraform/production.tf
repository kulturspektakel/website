# Production infrastructure — things the live website depends on at runtime:
# the Cloud Tasks queue, scheduler jobs, Pub/Sub subscription, monitoring
# alerts, and the API keys the app reads.
#
# Anything related to *how we deploy or operate the app* (CI service account,
# GitHub Actions secrets, terraform state IAM) lives in deployment.tf.

# ---- Tasks-invoker service account ----------------------------------------
#
# Single service account used for both sides of the auth:
#   - Cloud Scheduler / Cloud Tasks sign OIDC tokens *as* this SA when they
#     POST to Vercel; the Vercel `gcpAuth` middleware checks that the token's
#     email matches this SA.
#   - The Vercel app authenticates to the Cloud Tasks API as this SA (via the
#     JSON key in env_vars output) when it wants to enqueue a task.
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

resource "google_service_account_key" "tasks_key" {
  service_account_id = google_service_account.tasks.name
}

# Mirror the SA key JSON into Secret Manager so the env-sync script (and
# Vercel via that) can pull it without going through terraform output.
resource "google_secret_manager_secret" "tasks_sa_key" {
  secret_id = "GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "tasks_sa_key" {
  secret      = google_secret_manager_secret.tasks_sa_key.id
  secret_data = base64decode(google_service_account_key.tasks_key.private_key)
}

# ---- Cloud Tasks + Scheduler + Pub/Sub ------------------------------------

# Fail-fast queue for most tasks (email, slack, distance, membership, nonce,
# badges, …). A handful of attempts with short backoff: these either succeed
# quickly or point at a real bug worth surfacing.
resource "google_cloud_tasks_queue" "default" {
  name     = "default"
  location = local.region

  retry_config {
    max_attempts  = 5
    min_backoff   = "1s"
    max_backoff   = "60s"
    max_doublings = 16
  }

  depends_on = [google_project_service.apis]
}

# Patient queue for the band-application scrapers (demo resolution, Instagram,
# Spotify). These hit external sites that rate-limit us, so we retry many times
# with a deliberately long backoff — up to 1h between attempts — to let limits
# reset rather than hammering and getting blocked.
resource "google_cloud_tasks_queue" "scrapers" {
  name     = "scrapers"
  location = local.region

  rate_limits {
    # Keep concurrency low so we don't fan out parallel requests at the same
    # rate-limited host.
    max_concurrent_dispatches = 1
    max_dispatches_per_second = 1
  }

  retry_config {
    max_attempts  = 25
    min_backoff   = "30s"
    max_backoff   = "3600s"
    max_doublings = 16
  }

  depends_on = [google_project_service.apis]
}

# ---- Env config for the Vercel app ----------------------------------------
#
# Non-secret config that the app reads from its environment. Terraform owns
# every value here (locals + resource attributes), so this output is the
# single source of truth — `scripts/sync-env.js` reads it via
# `terraform output -json env_vars` instead of duplicating the literals.
# Real secrets are not here; those live in Secret Manager (MANAGED_SECRETS).
output "env_vars" {
  description = "Non-secret env config read by scripts/sync-env.js."
  value = {
    GCP_PROJECT_ID                  = local.project_id
    SITE_URL                        = local.site_url
    GCP_LOCATION                    = local.region
    GCP_TASKS_QUEUE                 = google_cloud_tasks_queue.default.name
    GCP_TASKS_SCRAPER_QUEUE         = google_cloud_tasks_queue.scrapers.name
    GCP_TASKS_SERVICE_ACCOUNT_EMAIL = google_service_account.tasks.email
  }
}

# Pub/Sub push subscription for Gmail notifications: every new email in our
# watched inboxes (booking/info/lager) → POST to /api/tasks/gmail-notification.
# The topic itself (`mail-reminder`) and the publisher side (Gmail watch via
# the legacy `gmail-reminder` SA) are pre-existing — we just add this consumer.
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

# ---- Google API keys -------------------------------------------------------

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

# Mirror the server-side Maps key into Secret Manager so sync-env can fetch
# it without going through terraform output.
resource "google_secret_manager_secret" "maps_server_key" {
  secret_id = "GOOGLE_MAPS_API_KEY_SERVER"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "maps_server_key" {
  secret      = google_secret_manager_secret.maps_server_key.id
  secret_data = google_apikeys_key.maps_server.key_string
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

# Mirror the browser Maps key into Secret Manager.
resource "google_secret_manager_secret" "maps_browser_key" {
  secret_id = "GOOGLE_MAPS_API_KEY"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret_version" "maps_browser_key" {
  secret      = google_secret_manager_secret.maps_browser_key.id
  secret_data = google_apikeys_key.maps_browser.key_string
}

# Dedicated key for the Google Sheets API — separate concern from Maps, lives
# on its own key so a Sheets leak doesn't expose Maps quota and vice versa.
# Used today by the legacy `~/api.kulturspektakel.de` project's
# `utils/readGoogleSheet.ts` (reads it from Secret Manager as GOOGLE_SHEETS_KEY).
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
  description = "Sheets API key. Sensitive. Consumed by the legacy api via SM."
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

# ---- Monitoring ------------------------------------------------------------

# Look up the existing "Monitoring" Slack channel — we don't manage it here
# (the auth token can't be round-tripped through Terraform state) but we want
# the new alerts to fire into the same channel as the other ones in the
# console.
data "google_monitoring_notification_channel" "slack" {
  display_name = "Monitoring"
  type         = "slack"
}

# Replaces the console-managed `www.kulturspektakel.de` uptime check.
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
