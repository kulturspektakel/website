import {createHmac, timingSafeEqual} from 'node:crypto';
import {createMiddleware} from '@tanstack/react-start';

/**
 * Verifies Slack's request signature so only genuine Slack requests reach the
 * public `/api/slack/*` endpoints (slash commands, interactivity, events).
 *
 * Slack signs the string `v0:{timestamp}:{rawBody}` with HMAC-SHA256 (hex)
 * using the app's signing secret. The digest arrives as
 * `X-Slack-Signature: v0=<hex>` and the request's unix-seconds send time as
 * `X-Slack-Request-Timestamp`. We recompute it over the exact raw body and
 * reject stale timestamps (>5 min) to blunt replay of a captured request.
 *
 * See https://api.slack.com/authentication/verifying-requests-from-slack
 */
const MAX_SKEW_SECONDS = 60 * 5;

/** HMAC-SHA256 of Slack's signature base string, in the `v0=<hex>` wire form. */
export function slackSignature(
  timestamp: string,
  rawBody: string,
  signingSecret: string,
): string {
  return (
    'v0=' +
    createHmac('sha256', signingSecret)
      .update(`v0:${timestamp}:${rawBody}`, 'utf8')
      .digest('hex')
  );
}

/**
 * True if `request` carries a valid, fresh Slack signature. Reads the raw body
 * from a clone so the handler can still consume the original request (as
 * `formData()`/`json()`); Slack signs the exact bytes, so the body must not be
 * re-encoded before hashing. Returns `false` (never throws) on any missing
 * header, stale timestamp, or mismatch.
 */
export async function verifySlackRequest(request: Request): Promise<boolean> {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    console.error('[slackAuth] SLACK_SIGNING_SECRET is not set; rejecting');
    return false;
  }

  const signature = request.headers.get('X-Slack-Signature');
  const timestamp = request.headers.get('X-Slack-Request-Timestamp');
  if (!signature || !timestamp) {
    return false;
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) {
    return false;
  }

  const expected = slackSignature(timestamp, await request.clone().text(), secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Request middleware for the `/api/slack/*` routes. Every Slack request (slash
 * commands, interactivity, events) is a signed POST, so we enforce the
 * signature on POST and pass non-POST through untouched — the only non-Slack
 * handler on these routes is the `/api/slack/token` GET (the Nuclino modal's
 * redirect link, which a browser hits without a Slack signature and which is
 * gated by its own one-time nonce). Returns 403 on an invalid signature.
 */
export const verifySlackSignature = createMiddleware({type: 'request'}).server(
  async ({request, next}) => {
    if (request.method !== 'POST') {
      return next();
    }
    if (!(await verifySlackRequest(request))) {
      return new Response('Forbidden', {status: 403});
    }
    return next();
  },
);
