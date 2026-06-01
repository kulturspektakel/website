import {prismaClient} from '../../utils/prismaClient.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';

/**
 * Delayed cleanup of a `Nonce` row at its `expiresAt`. The nonce is normally
 * single-use (consumed by `https://api.kulturspektakel.de/saml/login`); this
 * just removes the row whether or not it was consumed.
 */
export async function handleNonceInvalidate(
  request: Request,
): Promise<Response> {
  const {nonce} = await readJsonPayload<{nonce: string}>(request);
  await prismaClient.nonce.delete({where: {nonce}}).catch(() => null);
  return new Response(null, {status: 204});
}
