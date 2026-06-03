# Deployment / CI infrastructure — everything that lets us *ship* the app:
# the service account GitHub Actions uses to read Secret Manager (so it can
# push env vars to Vercel), its key, and the GH Actions secret entry that
# wires it up.
#
# Runtime infrastructure (Cloud Tasks queue, monitoring, API keys, etc.)
# lives in production.tf.

resource "google_service_account" "ci_secret_pusher" {
  account_id   = "ci-secret-pusher"
  display_name = "CI: read SM secrets, push to Vercel"
  depends_on   = [google_project_service.apis]
}

resource "google_project_iam_member" "ci_secret_pusher_sm" {
  project = local.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.ci_secret_pusher.email}"
}

resource "google_service_account_key" "ci_secret_pusher" {
  service_account_id = google_service_account.ci_secret_pusher.name
}

# Read-only access for the CI "terraform drift" check (.github/workflows/
# main.yml). CI never applies — we apply locally — it only runs
# `terraform plan -refresh=false` to fail the deploy if committed config
# wasn't applied. That plan still reads the state object and the two data
# sources (project + monitoring channel), routed through the provider's
# quota-project override. These are the narrowest roles covering exactly
# that, far less than the project-wide read a full refreshing plan needs.
resource "google_storage_bucket_iam_member" "ci_state_reader" {
  bucket = "gmail-reminder-api-tfstate"
  role   = "roles/storage.objectViewer"
  member = "serviceAccount:${google_service_account.ci_secret_pusher.email}"
}

resource "google_project_iam_member" "ci_plan_reader" {
  for_each = toset([
    "roles/browser",                           # data.google_project
    "roles/monitoring.viewer",                 # data.google_monitoring_notification_channel
    "roles/serviceusage.serviceUsageConsumer", # provider user_project_override
  ])
  project = local.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.ci_secret_pusher.email}"
}

# Exposed for manual rotation: when this key ever changes (terraform
# destroy + recreate), push the new value to the GH Actions secret via
#   terraform -chdir=terraform output -raw ci_secret_pusher_key | \
#     gh secret set GCP_SA_KEY -R kulturspektakel/website
output "ci_secret_pusher_key" {
  description = "JSON SA key for the CI sync workflow. Sensitive."
  value       = base64decode(google_service_account_key.ci_secret_pusher.private_key)
  sensitive   = true
}
