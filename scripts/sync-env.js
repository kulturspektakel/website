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
 * Pass `--vercel` to also push every var to the Vercel project (Production
 * + Development; preview is skipped — Vercel CLI non-interactive limitation).
 *
 * Auth: ADC. Locally that's `gcloud auth application-default login`; in CI
 * it's whatever `google-github-actions/auth` set up via the GCP_SA_KEY
 * GitHub Actions secret.
 */
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = resolve(ROOT, '.env');
const ENV_TYPES = resolve(ROOT, 'types/env.d.ts');
const TERRAFORM_DIR = resolve(ROOT, 'terraform');
const VERCEL = resolve(ROOT, 'node_modules/.bin/vercel');

const ENV_VARS = {
  // Non-secret config — terraform `env_vars` output.
  GCP_PROJECT_ID: 'terraform',
  GCP_LOCATION: 'terraform',
  SITE_URL: 'terraform',
  GCP_TASKS_QUEUE: 'terraform',
  GCP_TASKS_SCRAPER_QUEUE: 'terraform',
  GCP_TASKS_SERVICE_ACCOUNT_EMAIL: 'terraform',

  // Secrets — Google Secret Manager.
  AWS_ACCESS_KEY_ID: 'secret',
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
  NUCLINO_ANONYMOUS_PASSWORD: 'secret',
  NUCLINO_TEAM_ID: 'secret',
  SAML_PRIVATE_KEY: 'secret',
  SLACK_BOT_TOKEN: 'secret',
  SPOTIFY_CLIENT_ID: 'secret',
  SPOTIFY_CLIENT_SECRET: 'secret',
  STRIPE_API_KEY: 'secret',
  STRIPE_SIGNING_SECRET: 'secret',
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

async function loadSecrets(projectId) {
  const client = new SecretManagerServiceClient();
  const fetched = await Promise.all(
    namesFrom('secret').map(async (name) => {
      const [version] = await client.accessSecretVersion({
        name: `projects/${projectId}/secrets/${name}/versions/latest`,
      });
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

function pushToVercel(envVars) {
  // In CI there's no interactive `vercel login`, so the CLI needs the token
  // passed explicitly — otherwise every `env add/rm` fails with "No existing
  // credentials found" and the sync silently no-ops (it doesn't fail the build).
  const tokenArgs = process.env.VERCEL_TOKEN
    ? ['--token', process.env.VERCEL_TOKEN]
    : [];
  const failures = [];
  for (const name of Object.keys(envVars).sort()) {
    const value = envVars[name];
    for (const environment of ['production', 'development']) {
      spawnSync(VERCEL, ['env', 'rm', name, environment, '--yes', ...tokenArgs], {
        encoding: 'utf-8',
        timeout: 60_000,
      });
      const result = spawnSync(
        VERCEL,
        ['env', 'add', name, environment, ...tokenArgs],
        {
          input: value,
          encoding: 'utf-8',
          timeout: 60_000,
        },
      );
      const ok = result.status === 0;
      console.log(
        `${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(40)} ${environment}`,
      );
      if (!ok) {
        console.log(`      stderr: ${(result.stderr ?? '').trim().slice(-200)}`);
        failures.push(`${name} (${environment})`);
      }
    }
  }
  // Fail loudly: a silent partial sync is how missing secrets reached
  // production unnoticed. Attempt every var first so the log lists them all,
  // then throw so the build fails.
  if (failures.length) {
    throw new Error(
      `Failed to push ${failures.length} env var(s) to Vercel: ${failures.join(', ')}`,
    );
  }
}

const envVars = await loadEnvVars();

writeFileSync(ENV_FILE, renderEnv(envVars));
console.log(`wrote .env (${Object.keys(envVars).length} vars)`);

writeFileSync(ENV_TYPES, renderTypes(Object.keys(envVars)));
console.log('wrote types/env.d.ts');

if (process.argv.includes('--vercel')) {
  console.log('pushing to Vercel (this takes ~30s)...');
  pushToVercel(envVars);
}
