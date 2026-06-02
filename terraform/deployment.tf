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

# Pushes the SA key into the website repo's GH Actions secrets. A
# `terraform apply` keeps this in sync if the key ever rotates, so the
# .github/workflows/sync-env.yml workflow always has working credentials.
resource "github_actions_secret" "gcp_sa_key" {
  repository  = "website"
  secret_name = "GCP_SA_KEY"
  value       = base64decode(google_service_account_key.ci_secret_pusher.private_key)
}
