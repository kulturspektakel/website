terraform {
  required_version = ">= 1.6.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
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

locals {
  project_id = "gmail-reminder-api"
  region     = "europe-west1"
  site_url   = "https://www.kulturspektakel.de"
}

data "google_project" "this" {
  project_id = local.project_id
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
