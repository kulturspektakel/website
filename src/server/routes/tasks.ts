import {ApiError} from '../../utils/apiError.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';

/**
 * Scheduled task hit every 5 minutes by Cloud Scheduler. Currently a demo —
 * just logs that it ran. Returns 204 so Cloud Scheduler records success.
 */
export async function handleHeartbeat(): Promise<Response> {
  console.log(`[heartbeat] tick at ${new Date().toISOString()}`);
  return new Response(null, {status: 204});
}

/**
 * Ad-hoc task executed by Cloud Tasks after `enqueueGcpTask('demo', …)`.
 * Receives the JSON payload the trigger queued up.
 */
export async function handleDemo(request: Request): Promise<Response> {
  let payload: {message?: unknown};
  try {
    payload = (await request.json()) as {message?: unknown};
  } catch (e) {
    throw new ApiError(400, 'Bad Request', e as Error);
  }
  if (typeof payload.message !== 'string') {
    throw new ApiError(400, 'Bad Request', new Error('Missing `message`'));
  }
  console.log(`[demo task] ${payload.message}`);
  return new Response(null, {status: 204});
}

/**
 * Demo trigger: enqueues a `demo` task. Pairs with `handleDemo` to exercise
 * the Vercel → Cloud Tasks → Vercel round trip. In dev the enqueue is a no-op
 * log; in prod it creates a real Cloud Tasks entry.
 */
export async function handleTriggerTask(request: Request): Promise<Response> {
  let message = 'hello from trigger-task';
  let delaySeconds = 0;
  let key: string | undefined;
  if (request.headers.get('content-type')?.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
      delaySeconds?: unknown;
      key?: unknown;
    };
    if (typeof body.message === 'string') {
      message = body.message;
    }
    if (typeof body.delaySeconds === 'number' && body.delaySeconds > 0) {
      delaySeconds = body.delaySeconds;
    }
    if (typeof body.key === 'string') {
      key = body.key;
    }
  }
  const scheduleAt =
    delaySeconds > 0 ? new Date(Date.now() + delaySeconds * 1000) : undefined;
  await enqueueGcpTask('demo', {message}, {scheduleAt, key});
  return new Response(
    JSON.stringify({
      enqueued: 'demo',
      message,
      scheduledAt: scheduleAt?.toISOString() ?? null,
      key: key ?? null,
    }),
    {status: 202, headers: {'Content-Type': 'application/json'}},
  );
}
