#!/usr/bin/env node
/**
 * Single source of truth for the app's environment.
 *
 * `ENV_VARS` below lists every variable the app uses and where its value
 * comes from. From that one list this script: fetches the values, writes
 * `.env`, generates the typed accessor, and (with `--vercel`) pushes
 * everything to Vercel.
 *
 * Two sources:
 *   - 'terraform' → the `env_vars` output in terraform/production.tf. Holds
 *     non-secret config (project id, region, site url, queue names, the
 *     tasks-invoker SA email, …). Terraform owns the values; we read them
 *     with `terraform output` so there are no duplicated literals here.
 *     Requires `terraform init` in terraform/ (CI does this — see main.yml).
 *   - 'secret' → Google Secret Manager, looked up by the same name.
 *
 * Adding a var: define its value (add an entry to the terraform `env_vars`
 * output, or `gcloud secrets create NAME`), then add one line to `ENV_VARS`.
 *
 * Pass `--vercel` to also push the runtime vars to the Vercel project's
 * Production environment (one REST call; see `pushToVercel`).
 *
 * Auth: ADC. Locally that's `gcloud auth application-default login`; in CI
 * it's whatever `google-github-actions/auth` set up via the GCP_SA_KEY
 * GitHub Actions secret.
 */
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {spawnSync} from 'node:child_process';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env');
const ENV_TYPES = resolve(ROOT, 'types/env.d.ts');
const TERRAFORM_DIR = resolve(ROOT, 'terraform');

const ENV_VARS = {
  // Non-secret config — terraform `env_vars` output.
  GCP_PROJECT_ID: 'terraform',
  GCP_LOCATION: 'terraform',
  SITE_URL: 'terraform',
  GCP_TASKS_QUEUE: 'terraform',
  GCP_TASKS_SCRAPER_QUEUE: 'terraform',
  GCP_TASKS_SERVICE_ACCOUNT_EMAIL: 'terraform',
  // Sentry DSN is public (client + server), so it's non-secret config.
  VITE_SENTRY_DSN: 'terraform',

  // Secrets — Google Secret Manager.
  APIFY_TOKEN: 'secret',
  // Private key of the CrewCard Pass Type ID certificate (the certificate itself
  // is public, in src/server/appleWallet/certificates.ts).
  APPLE_WALLET_CREW_PASS_PRIVATE_KEY: 'secret',
  AWS_ACCESS_KEY_ID: 'secret',
  // Build-time only: the Sentry Vite plugin uses this to upload source maps.
  SENTRY_AUTH_TOKEN: 'secret',
  AWS_SECRET_ACCESS_KEY: 'secret',
  CONTACTLESS_SALT: 'secret',
  DATABASE_URL: 'secret',
  FACEBOOK_ACCESS_TOKEN: 'secret',
  GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON: 'secret',
  GOOGLE_MAPS_API_KEY: 'secret',
  GOOGLE_MAPS_API_KEY_SERVER: 'secret',
  GOOGLE_SERVICE_ACCOUNT_EMAIL: 'secret',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'secret',
  GOOGLE_SHEETS_KEY: 'secret',
  JWT_SECRET: 'secret',
  // Neon Realtime (live queries on /crew/booking). The URL isn't secret, but it
  // comes from the Neon console together with the secret, so both live in GSM.
  NEON_REALTIME_SECRET: 'secret',
  NEON_REALTIME_URL: 'secret',
  NUCLINO_ANONYMOUS_PASSWORD: 'secret',
  NUCLINO_API_KEY: 'secret',
  NUCLINO_TEAM_ID: 'secret',
  NUCLINO_WORKSPACE_ID: 'secret',
  SAML_PRIVATE_KEY: 'secret',
  SLACK_BOT_TOKEN: 'secret',
  SLACK_SIGNING_SECRET: 'secret',
  SPOTIFY_CLIENT_ID: 'secret',
  SPOTIFY_CLIENT_SECRET: 'secret',
  STRIPE_API_KEY: 'secret',
  STRIPE_SIGNING_SECRET: 'secret',
  TWILIO_ACCOUNT_SID: 'secret',
  TWILIO_API_KEY: 'secret',
  TWILIO_API_SECRET: 'secret',
  TWILIO_AUTH_TOKEN: 'secret',
  TWILIO_DIAL_NUMBERS: 'secret',
  YOUTUBE_API_KEY: 'secret',
};

const namesFrom = (source) =>
  Object.keys(ENV_VARS).filter((name) => ENV_VARS[name] === source);

function loadTerraformOutputs() {
  const result = spawnSync(
    'terraform',
    [`-chdir=${TERRAFORM_DIR}`, 'output', '-json', 'env_vars'],
    {encoding: 'utf-8', timeout: 60_000},
  );
  if (result.status !== 0) {
    throw new Error(
      'Failed to read terraform outputs (run `terraform init` in terraform/ ' +
        `first):\n${(result.stderr ?? '').trim()}`,
    );
  }
  const outputs = JSON.parse(result.stdout);

  // The manifest and the terraform output must list exactly the same
  // 'terraform' vars — otherwise one was changed without the other.
  const declared = new Set(namesFrom('terraform'));
  const provided = new Set(Object.keys(outputs));
  const missing = [...declared].filter((n) => !provided.has(n));
  const extra = [...provided].filter((n) => !declared.has(n));
  if (missing.length) {
    throw new Error(
      `Declared as 'terraform' in ENV_VARS but absent from the env_vars ` +
        `output: ${missing.join(', ')}`,
    );
  }
  if (extra.length) {
    throw new Error(
      `Present in the env_vars output but not declared in ENV_VARS ` +
        `(add them): ${extra.join(', ')}`,
    );
  }
  return outputs;
}

// gRPC codes worth another try: INTERNAL (13), which Google's auth backend
// returns now and then ("Authentication backend internal server error. Please
// retry.") and which the client library doesn't retry itself, UNAVAILABLE (14)
// and DEADLINE_EXCEEDED (4).
const RETRYABLE_CODES = new Set([4, 13, 14]);

async function withRetry(label, fn, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= attempts || !RETRYABLE_CODES.has(e?.code)) {
        throw e;
      }
      const delay = 500 * 2 ** (attempt - 1);
      console.warn(
        `${label}: ${e.message} — retrying in ${delay} ms (${attempt}/${attempts - 1})`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function loadSecrets(projectId) {
  const client = new SecretManagerServiceClient();
  const fetched = await Promise.all(
    namesFrom('secret').map(async (name) => {
      const [version] = await withRetry(name, () =>
        client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${name}/versions/latest`,
        }),
      );
      const data = version.payload?.data;
      if (!data) {
        throw new Error(`Empty value for secret ${name}`);
      }
      return [name, Buffer.from(data).toString('utf-8')];
    }),
  );
  return Object.fromEntries(fetched);
}

async function loadEnvVars() {
  const terraformVars = loadTerraformOutputs();
  // Project id is itself a terraform var, and we need it to address SM.
  const secrets = await loadSecrets(terraformVars.GCP_PROJECT_ID);
  const values = {...terraformVars, ...secrets};
  return Object.fromEntries(
    Object.keys(ENV_VARS).map((name) => [name, values[name]]),
  );
}

function renderEnv(envVars) {
  const lines = [
    '# AUTO-GENERATED by `yarn sync:env`. Do not edit by hand —',
    '# sources: terraform outputs + Secret Manager (see scripts/sync-env.js).',
    '',
  ];
  for (const name of Object.keys(envVars).sort()) {
    const value = envVars[name];
    if (name === 'GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON') {
      // Compact-JSON single-line, single-quoted so the `\n` escapes inside
      // private_key survive dotenv parsing.
      const compact = JSON.stringify(JSON.parse(value));
      lines.push(`${name}='${compact}'`);
    } else {
      lines.push(`${name}="${value}"`);
    }
  }
  return lines.join('\n') + '\n';
}

function renderTypes(names) {
  const lines = [
    '// AUTO-GENERATED by `yarn sync:env`. Do not edit by hand —',
    '// source of truth is the ENV_VARS manifest in scripts/sync-env.js.',
    '',
    'declare namespace NodeJS {',
    '  interface ProcessEnv {',
  ];
  for (const name of [...names].sort()) {
    lines.push(`    ${name}: string;`);
  }
  lines.push('  }');
  lines.push('}');
  return lines.join('\n') + '\n';
}

// Locally, reuse the `vercel login` session; CI passes VERCEL_TOKEN.
function vercelToken() {
  if (process.env.VERCEL_TOKEN) {
    return process.env.VERCEL_TOKEN;
  }
  const authFiles = [
    resolve(homedir(), 'Library/Application Support/com.vercel.cli/auth.json'),
    resolve(homedir(), '.local/share/com.vercel.cli/auth.json'),
  ];
  for (const file of authFiles) {
    if (existsSync(file)) {
      const {token} = JSON.parse(readFileSync(file, 'utf-8'));
      if (token) {
        return token;
      }
    }
  }
  throw new Error(
    'No Vercel credentials: set VERCEL_TOKEN or run `vercel login`.',
  );
}

// One request for every var: the endpoint accepts an array, and `upsert=true`
// overwrites a key that already exists for the target. (This used to be an
// `env rm` + `env add` CLI call per var and environment, ~2.5 min in CI.)
//
// Production only. Local dev reads `.env` written by this script, so the
// Vercel "development" target (used only by `vercel env pull`/`vercel dev`)
// had no consumer. Preview deployments don't get these vars either.
async function pushToVercel(envVars) {
  const {projectId, orgId} = JSON.parse(
    readFileSync(resolve(ROOT, '.vercel/project.json'), 'utf-8'),
  );
  const body = Object.keys(envVars)
    .sort()
    .map((key) => ({
      key,
      value: envVars[key],
      type: 'encrypted',
      target: ['production'],
    }));
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?upsert=true&teamId=${orgId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${vercelToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  const result = await res.json().catch(() => ({}));
  // A batch can partially fail with a 2xx: per-key errors come back in
  // `failed`. Fail loudly either way, since a silent partial sync is how missing
  // secrets reached production unnoticed.
  const failed = (result.failed ?? []).map(
    (f) => `${f.error?.key ?? '?'}: ${f.error?.message ?? f.error?.code}`,
  );
  if (!res.ok || failed.length) {
    throw new Error(
      `Failed to push env vars to Vercel (HTTP ${res.status}): ` +
        (failed.length
          ? failed.join(', ')
          : (result.error?.message ?? JSON.stringify(result))),
    );
  }
  console.log(`pushed ${body.length} vars to Vercel (production)`);
}

const envVars = await loadEnvVars();

writeFileSync(ENV_FILE, renderEnv(envVars));
console.log(`wrote .env (${Object.keys(envVars).length} vars)`);

writeFileSync(ENV_TYPES, renderTypes(Object.keys(envVars)));
console.log('wrote types/env.d.ts');

if (process.argv.includes('--vercel')) {
  await pushToVercel(envVars);
}
