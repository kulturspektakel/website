import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {nonce as nonceTable} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';

/**
 * Delayed cleanup of a `Nonce` row at its `expiresAt`. The nonce is normally
 * single-use (consumed by `https://api.kulturspektakel.de/saml/login`); this
 * just removes the row whether or not it was consumed.
 */
export async function handleNonceInvalidate(
  request: Request,
): Promise<Response> {
  const {nonce} = await readJsonPayload<{nonce: string}>(request);
  // A no-op if the nonce was already consumed.
  await db.delete(nonceTable).where(eq(nonceTable.nonce, nonce));
  return new Response(null, {status: 204});
}
