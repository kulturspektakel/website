import {ApiError} from '../../utils/apiError.server';
import {enqueueGcpTask} from '../../utils/enqueueGcpTask.server';
import {prismaClient} from '../../utils/prismaClient.server';
import {slackApiRequest, type SlackApiUser} from '../../utils/slack.server';
import {upsertViewer} from '../../utils/upsertViewer.server';

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
/**
 * Async half of the Nuclino SSO flow: the user has submitted their email on
 * `/nuclino-sso`, we've already created the `NonceRequest` row and enqueued
 * this task. Now we look the user up on Slack, link them to the
 * `NonceRequest`, and DM them a pair of approve/reject buttons.
 *
 * The button clicks land on the legacy api's Slack interactivity webhook,
 * which flips `NonceRequest.status` — the website polls `checkNonceRequest`
 * and proceeds when it sees `Approved`.
 */
export async function handleCreateNonceRequest(
  request: Request,
): Promise<Response> {
  const {id, email} = await readJsonPayload<{id: string; email: string}>(
    request,
  );

  const slackUser = await slackApiRequest<{user: SlackApiUser}>(
    `users.lookupByEmail?email=${encodeURIComponent(email)}`,
  );
  if (!slackUser.ok) {
    console.warn(`[createNonceRequest] no Slack user for ${email}`);
    return new Response(null, {status: 204});
  }

  const viewer = await upsertViewer(slackUser.user.id, 'createNonceRequest');
  await prismaClient.nonceRequest.update({
    where: {id},
    data: {createdForId: viewer.id},
  });

  const post = await slackApiRequest('chat.postMessage', {
    channel: slackUser.user.id,
    text: 'Nuclino Login-Anfrage bestätigen',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Bestätige, dass du dich gerade mit deinem Nuclino-Account einloggen möchtest. Wenn du gerade nicht versuchst dich einzuloggen, lehne die Anfrage ab.',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            style: 'primary',
            text: {type: 'plain_text', text: 'Bestätigen'},
            action_id: 'approve-nonce-request',
            value: id,
          },
          {
            type: 'button',
            style: 'danger',
            text: {type: 'plain_text', text: 'Ablehnen'},
            action_id: 'reject-nonce-request',
            value: id,
          },
        ],
      },
    ],
  });
  if (!post.ok) {
    throw new ApiError(
      502,
      'Slack chat.postMessage failed',
      new Error(JSON.stringify(post)),
    );
  }
  return new Response(null, {status: 204});
}

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
  await prismaClient.nonceRequest
    .delete({where: {id: nonceRequestId}})
    .catch(() => null);
  return new Response(null, {status: 204});
}

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

async function readJsonPayload<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (e) {
    throw new ApiError(400, 'Bad Request', e as Error);
  }
}

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
