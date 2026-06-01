import {ApiError} from '../../utils/apiError.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';

/**
 * Ad-hoc task executed by Cloud Tasks after `enqueueGcpTask('demo', …)`.
 * Receives the JSON payload the trigger queued up.
 */
export async function handleDemo(request: Request): Promise<Response> {
  const payload = await readJsonPayload<{message?: unknown}>(request);
  if (typeof payload.message !== 'string') {
    throw new ApiError(400, 'Bad Request', new Error('Missing `message`'));
  }
  console.log(`[demo task] ${payload.message}`);
  return new Response(null, {status: 204});
}
