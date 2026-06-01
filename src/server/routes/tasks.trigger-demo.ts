import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';

/**
 * Demo trigger: enqueues a `demo` task. Pairs with `handleDemo` to exercise
 * the Vercel → Cloud Tasks → Vercel round trip. In dev the enqueue is a no-op
 * log; in prod it creates a real Cloud Tasks entry.
 */
export async function handleTriggerDemo(request: Request): Promise<Response> {
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
