import {createMiddleware} from '@tanstack/react-start';
import {OAuth2Client} from 'google-auth-library';
import type {GcpToken} from './apiAuth.server';

const oauthClient = new OAuth2Client();

/**
 * Resolve the GCP identity behind a request, or `undefined` if unauthenticated.
 *
 * In production this verifies the `Authorization: Bearer …` header as a Google
 * OIDC token: signature is checked against Google's public keys, the `aud`
 * claim must equal `audience`, and the `email` claim must match
 * `GCP_TASKS_SERVICE_ACCOUNT_EMAIL` (with `email_verified === true`). Cloud
 * Scheduler and Cloud Tasks both attach such tokens when configured with
 * `oidc_token`, so this is enough to prove the request came from our GCP
 * project rather than an arbitrary caller.
 *
 * In dev (`NODE_ENV !== 'production'`) verification is skipped and a stub
 * token is returned, so task routes are callable with `curl` from a local dev
 * server without GCP credentials.
 */
export async function parseGcpToken(
  request: Request,
  audience: string,
): Promise<GcpToken | undefined> {
  if (process.env.NODE_ENV !== 'production') {
    return {iss: 'gcp', email: 'dev@local', audience};
  }

  const expectedEmail = process.env.GCP_TASKS_SERVICE_ACCOUNT_EMAIL;
  if (!expectedEmail) {
    console.error(
      '[gcpAuth] GCP_TASKS_SERVICE_ACCOUNT_EMAIL not set; rejecting',
    );
    return undefined;
  }

  const match = request.headers.get('authorization')?.match(/^Bearer (.+)$/);
  if (!match) {
    return undefined;
  }
  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: match[1],
      audience,
    });
    const payload = ticket.getPayload();
    if (
      !payload ||
      payload.email !== expectedEmail ||
      payload.email_verified !== true
    ) {
      return undefined;
    }
    return {iss: 'gcp', email: payload.email, audience};
  } catch (e) {
    console.error('[gcpAuth] OIDC verification failed:', e);
    return undefined;
  }
}

/**
 * Parent-route middleware for the `/api/tasks/*` layout. The expected OIDC
 * `aud` is derived from the path — `/api/tasks/<task>` → `<task>` — which is
 * exactly the audience `enqueueGcpTask` signs each token with. Mounting this on
 * the `api.tasks` layout route authenticates every task subroute automatically,
 * so a newly added route under `/api/tasks/` can't accidentally ship
 * unauthenticated. The per-task `aud` binding is preserved: a token minted for
 * `send-email` only validates against `/api/tasks/send-email`.
 *
 * Requires a GCP-signed OIDC token whose `aud` matches the derived task name and
 * whose signer matches `GCP_TASKS_SERVICE_ACCOUNT_EMAIL`; returns 401 otherwise.
 * On success exposes the token to handlers as `context.gcp`. Bypassed in dev —
 * see `parseGcpToken`.
 */
export const gcpTasksAuth = createMiddleware({type: 'request'}).server(
  async ({request, next}) => {
    const task = new URL(request.url).pathname.split('/')[3];
    const token = task ? await parseGcpToken(request, task) : undefined;
    if (!token) {
      return new Response('Unauthorized', {status: 401});
    }
    return next({context: {gcp: token}});
  },
);
