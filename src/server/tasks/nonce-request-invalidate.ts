import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {nonceRequest} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';

/**
 * Delayed cleanup of a `NonceRequest` row that was never approved (or whose
 * approval is now beyond `expiresAt`). Scheduled with `scheduleAt = expiresAt`
 * when the request is created. A pre-approved row may already have been
 * consumed by `checkNonceRequest`, in which case the delete just no-ops.
 */
export async function handleNonceRequestInvalidate(
  request: Request,
): Promise<Response> {
  const {nonceRequestId} = await readJsonPayload<{nonceRequestId: string}>(
    request,
  );
  await db.delete(nonceRequest).where(eq(nonceRequest.id, nonceRequestId));
  return new Response(null, {status: 204});
}
