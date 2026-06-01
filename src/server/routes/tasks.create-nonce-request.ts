import {ApiError} from '../../utils/apiError.server';
import {prismaClient} from '../../utils/prismaClient.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {slackApiRequest, type SlackApiUser} from '../../utils/slack.server';
import {upsertViewer} from '../../utils/upsertViewer.server';

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

  const viewer = await upsertViewer(slackUser.user);
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
