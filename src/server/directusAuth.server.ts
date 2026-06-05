import {createHmac, timingSafeEqual} from 'node:crypto';

/**
 * Decoded payload of a Directus `directus_session_token`. Directus signs these
 * with its `SECRET`, which for us is the value stored as `JWT_SECRET`.
 */
export type DirectusSession = {
  id: string;
  role: string;
  app_access: boolean;
  admin_access: boolean;
  session: string;
  iat: number;
  exp: number;
  iss: string;
};

/**
 * Verify a Directus session JWT and return its payload, or `undefined` when the
 * token is missing, malformed, signed with the wrong key, or expired.
 *
 * Checks, in order: a well-formed `header.payload.signature`; an HS256 `alg`
 * (any other algorithm — notably `none` — is rejected, closing the classic
 * algorithm-confusion hole); an HMAC-SHA256 signature over `header.payload`
 * that matches `JWT_SECRET` (compared in constant time); and an unexpired
 * `exp`. The signer (`iss: "directus"`) is implied by the signature, so we
 * don't re-check it.
 */
export function verifyDirectusSession(
  token: string | undefined,
): DirectusSession | undefined {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token) {
    return undefined;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return undefined;
  }
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: {alg?: string};
  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
  } catch {
    return undefined;
  }
  if (header.alg !== 'HS256') {
    return undefined;
  }

  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const provided = Buffer.from(signatureB64, 'base64url');
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return undefined;
  }

  let payload: DirectusSession;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch {
    return undefined;
  }
  // `exp` is seconds since the epoch.
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    return undefined;
  }

  return payload;
}
