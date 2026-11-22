import {createHmac, timingSafeEqual} from 'crypto';

/**
 * The short-lived token of a wallet pass download link
 * (`/api/crewcard/wallet/apple/<token>`): the card's id and an expiry, signed.
 * Stateless and not single-use (a cancelled add-to-Wallet sheet or a repeated
 * request mustn't burn it); the short expiry is what keeps a forwarded link
 * from producing more passes. Installed passes update through the web service
 * instead, which needs no token.
 *
 * Signed with `CONTACTLESS_SALT` (the card payload's secret); the context
 * prefix keeps a token's signature from ever matching anything else signed
 * with it.
 */
const CONTEXT = 'crew-card-pass-download:';
const VALID_MS = 5 * 60 * 1000;

function signature(data: string): Buffer {
  return createHmac('sha256', process.env.CONTACTLESS_SALT!)
    .update(CONTEXT + data)
    .digest();
}

export function signPassDownloadToken(
  crewCardId: string,
  now = new Date(),
): string {
  const data = `${crewCardId}.${now.getTime() + VALID_MS}`;
  return `${Buffer.from(data).toString('base64url')}.${signature(data).toString('base64url')}`;
}

/** The card id of a valid, unexpired token; undefined otherwise. */
export function verifyPassDownloadToken(
  token: string,
  now = new Date(),
): string | undefined {
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) {
    return undefined;
  }
  const data = Buffer.from(encoded, 'base64url').toString();
  const expected = signature(data);
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return undefined;
  }
  const [crewCardId, expiresAt] = data.split('.');
  if (!crewCardId || !(Number(expiresAt) > now.getTime())) {
    return undefined;
  }
  return crewCardId;
}
