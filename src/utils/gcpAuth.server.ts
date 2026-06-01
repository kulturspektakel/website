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
 * Request middleware that requires a GCP-signed OIDC token whose `aud` matches
 * `audience` and whose signer matches `GCP_TASKS_SERVICE_ACCOUNT_EMAIL`.
 * Returns 401 otherwise. On success exposes the token to handlers as
 * `context.gcp`. Bypassed in dev — see `parseGcpToken`.
 */
export const gcpAuth = (audience: string) =>
  createMiddleware({type: 'request'}).server(async ({request, next}) => {
    const token = await parseGcpToken(request, audience);
    if (!token) {
      return new Response('Unauthorized', {status: 401});
    }
    return next({context: {gcp: token}});
  });
