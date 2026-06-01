import {CloudTasksClient} from '@google-cloud/tasks';

type EnqueueOptions = {
  scheduleAt?: Date;
  /**
   * User-controlled task name (alphanumerics, `_` or `-`, ≤ 500 chars). When
   * given, the task is created at a stable address so it can be cancelled with
   * `cancelGcpTask(key)`. Omit to let Cloud Tasks generate an id (faster, but
   * not cancellable by key).
   *
   * Cloud Tasks deduplicates by name: after a task is deleted or completed,
   * the same key is rejected with `ALREADY_EXISTS` for up to ~1 hour
   * (deleted) / ~9 days (executed). For debounce-style "schedule every N
   * seconds, cancel previous", embed a fresh timestamp/counter in the key
   * (e.g. `${userId}-${Date.now()}`) so each scheduling cycle uses a new name
   * — track that name in your own storage to cancel it next time.
   */
  key?: string;
};

/**
 * Enqueue a task in our Cloud Tasks queue. The queue is configured (in
 * Terraform) to retry on non-2xx responses; this just adds the entry.
 *
 * Cloud Tasks will POST to `${SITE_URL}/api/tasks/${task}` with the payload as
 * a JSON body and an OIDC bearer token signed by
 * `GCP_TASKS_SERVICE_ACCOUNT_EMAIL` with `aud = task`. The matching
 * `gcpAuth(task)` middleware on the receiving route verifies that token.
 *
 * In dev (`NODE_ENV !== 'production'`) no real call is made — the helper logs
 * the payload and returns. This keeps the trigger route callable from a local
 * dev server without GCP credentials.
 *
 * Overloaded once per task name so the payload type is checked at every call
 * site, same shape as `scheduleTask` in `scheduleTask.server.ts`.
 */
export async function enqueueGcpTask(
  task: 'demo',
  payload: {message: string},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: 'create-nonce-request',
  payload: {id: string; email: string},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: 'nonce-request-invalidate',
  payload: {nonceRequestId: string},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: 'nonce-invalidate',
  payload: {nonce: string},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: 'badge-awarded',
  payload: {orderId: number},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: 'gmail-reminder',
  payload: {account: string; messageId: string},
  options?: EnqueueOptions,
): Promise<void>;
export async function enqueueGcpTask(
  task: string,
  payload: Record<string, unknown>,
  options?: EnqueueOptions,
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const when = options?.scheduleAt
      ? ` at ${options.scheduleAt.toISOString()}`
      : '';
    const key = options?.key ? ` [key=${options.key}]` : '';
    console.log(`[enqueueGcpTask] dev no-op: ${task}${when}${key}`, payload);
    return;
  }

  const ctx = gcpContext();
  await ctx.client.createTask({
    parent: ctx.queuePath,
    task: {
      name: options?.key ? `${ctx.queuePath}/tasks/${options.key}` : undefined,
      // Defer execution until `scheduleAt` if given (up to 30 days out, per
      // Cloud Tasks). Without it the task runs as soon as the queue can
      // dispatch it.
      scheduleTime: options?.scheduleAt
        ? {seconds: Math.floor(options.scheduleAt.getTime() / 1000)}
        : undefined,
      httpRequest: {
        url: `${ctx.siteUrl}/api/tasks/${task}`,
        httpMethod: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: Buffer.from(JSON.stringify(payload)).toString('base64'),
        oidcToken: {
          serviceAccountEmail: ctx.serviceAccountEmail,
          audience: task,
        },
      },
    },
  });
}

/**
 * Cancel a previously-enqueued task by the `key` it was created with. Safe to
 * call even if the task has already executed, been cancelled, or never
 * existed — those produce `NOT_FOUND` from Cloud Tasks, which we swallow.
 *
 * Dev: no-op log, same as `enqueueGcpTask`.
 */
export async function cancelGcpTask(key: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[cancelGcpTask] dev no-op: [key=${key}]`);
    return;
  }
  const ctx = gcpContext();
  try {
    await ctx.client.deleteTask({name: `${ctx.queuePath}/tasks/${key}`});
  } catch (e) {
    // gRPC NOT_FOUND has code 5; the task is already gone, which is what the
    // caller wanted anyway.
    if ((e as {code?: number}).code === 5) {
      return;
    }
    throw e;
  }
}

type GcpContext = {
  client: CloudTasksClient;
  queuePath: string;
  serviceAccountEmail: string;
  siteUrl: string;
};

let cachedContext: GcpContext | null = null;

function gcpContext(): GcpContext {
  if (cachedContext) {
    return cachedContext;
  }
  const projectId = requireEnv('GCP_PROJECT_ID');
  const location = requireEnv('GCP_LOCATION');
  const queue = requireEnv('GCP_TASKS_QUEUE');
  const serviceAccountEmail = requireEnv('GCP_TASKS_SERVICE_ACCOUNT_EMAIL');
  const siteUrl = requireEnv('SITE_URL');
  const credentials = JSON.parse(
    requireEnv('GCP_TASKS_SERVICE_ACCOUNT_KEY_JSON'),
  );
  const client = new CloudTasksClient({credentials, projectId});
  cachedContext = {
    client,
    queuePath: client.queuePath(projectId, location, queue),
    serviceAccountEmail,
    siteUrl,
  };
  return cachedContext;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}
