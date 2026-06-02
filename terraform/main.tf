terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
  backend "gcs" {
    bucket = "gmail-reminder-api-tfstate"
    prefix = "website"
  }
}

provider "google" {
  project = local.project_id
  region  = local.region
  # Required so the apikeys.googleapis.com API (which needs a quota project)
  # accepts requests made via user ADC credentials. Harmless for other APIs.
  user_project_override = true
  billing_project       = local.project_id
}

# GitHub provider authenticates from `gh auth token` (export GITHUB_TOKEN=$(gh
# auth token) before running terraform). Used only in deployment.tf to push
# the CI service account key into the website repo's GH Actions secrets.
provider "github" {
  owner = "kulturspektakel"
}

locals {
  project_id = "gmail-reminder-api"
  region     = "europe-west1"
  site_url   = "https://www.kulturspektakel.de"

  # Secrets read from Secret Manager and exposed as Vercel env vars under
  # the same name. Add an entry here (and create the SM secret via
  # `gcloud secrets create`) to make a new secret available to the app
  # via `env.NAME`.
  managed_secrets = toset([
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "CONTACTLESS_SALT",
    "DATABASE_URL",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "SLACK_BOT_TOKEN",
    "SPOTIFY_CLIENT_ID",
    "SPOTIFY_CLIENT_SECRET",
    "STRIPE_API_KEY",
  ])
}

data "google_project" "this" {
  project_id = local.project_id
}

# Single for_each data source for everything in `managed_secrets`.
# Adding a new secret = add a name to the set above + create it via gcloud.
data "google_secret_manager_secret_version" "managed" {
  for_each = local.managed_secrets
  secret   = each.key
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

# Single source of truth for everything the app expects in `process.env` /
# `env.X` (see src/utils/env.server.ts, which is auto-generated from this
# map's keys). `tools/sync-env.js` iterates this and writes .env + the
# typed env module + optionally pushes to Vercel.
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
    },
    # SM-backed secrets — env var name == SM secret name.
    {
      for name in local.managed_secrets :
      name => data.google_secret_manager_secret_version.managed[name].secret_data
    },
  )
}

output "env_vars" {
  description = "All values the app expects in process.env. Iterated by tools/sync-env.js."
  value       = local.env_vars
  sensitive   = true
}
