import {createHmac, timingSafeEqual} from 'node:crypto';
import {createMiddleware} from '@tanstack/react-start';

// Validates Twilio's `X-Twilio-Signature` so only genuine Twilio requests reach
// the public `/api/twilio/*` webhooks. The signature is an HMAC-SHA1 (base64) of
// the exact request URL Twilio called, followed by every POST param sorted by
// key and concatenated as key+value. The signing key is the account Auth Token
// (distinct from the API key used for outbound REST).
//
// See https://www.twilio.com/docs/usage/security#validating-requests

/** Reconstruct the public URL Twilio signed (its configured host, not the
 * proxied internal host), preserving path + query. */
function signedUrl(request: Request): string {
  const base = (process.env.SITE_URL ?? '').replace(/\/$/, '');
  const u = new URL(request.url);
  return `${base}${u.pathname}${u.search}`;
}

export function twilioSignature(
  url: string,
  params: URLSearchParams,
  authToken: string,
): string {
  let data = url;
  for (const key of [...params.keys()].sort()) {
    for (const value of params.getAll(key)) {
      data += key + value;
    }
  }
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export const verifyTwilioSignature = createMiddleware({type: 'request'}).server(
  async ({request, next}) => {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.error('TWILIO_AUTH_TOKEN is not set');
      return new Response('Internal Server Error', {status: 500});
    }

    const signature = request.headers.get('X-Twilio-Signature');
    if (!signature) {
      return new Response('Forbidden', {status: 403});
    }

    // The body is consumed here for validation, so handlers receive the parsed
    // params via `context.twilioParams` rather than re-reading the request.
    const form = await request.formData();
    const params = new URLSearchParams();
    for (const [key, value] of form.entries()) {
      params.append(key, typeof value === 'string' ? value : '');
    }

    const expected = twilioSignature(signedUrl(request), params, authToken);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return new Response('Forbidden', {status: 403});
    }

    return next({context: {twilioParams: params}});
  },
);
