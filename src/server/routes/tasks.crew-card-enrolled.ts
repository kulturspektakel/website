import {subDays} from 'date-fns';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {slackApiRequest} from '../../utils/slack.server';
import {ApiError} from '../../utils/apiError.server';
import {SlackChannel} from '../../utils/slackChannels';

export type CrewCardEnrolledPayload = {
  crewCardId: number[];
  validUntil: string;
};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/crewCardEnrolled.ts`
 * (which delegated to `sendCrewCardEnrollmentMessage`). Triggered from
 * `kultcash.ts` after a CrewCard enrollment is upserted: announces the
 * activation in #crewcards with a "Karte zuordnen" button.
 *
 * The button (`assign-crew-card-modal`) is still served by the legacy api's
 * Slack interactivity webhook — only the message dispatch has moved here.
 */
export async function handleCrewCardEnrolled(
  request: Request,
): Promise<Response> {
  const {crewCardId, validUntil} =
    await readJsonPayload<CrewCardEnrolledPayload>(request);

  const cardId = crewCardId
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();

  const formattedDate = subDays(new Date(validUntil), 1).toLocaleDateString(
    'de-DE',
    {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Berlin',
    },
  );

  const res = await slackApiRequest('chat.postMessage', {
    channel: SlackChannel.crewcards,
    text: `CrewCard ${cardId} wurde aktiviert`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `CrewCard \`${cardId}\` wurde bis einschließlich ${formattedDate} aktiviert`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {type: 'plain_text', text: 'Karte zuordnen', emoji: true},
            value: cardId,
            action_id: 'assign-crew-card-modal',
          },
        ],
      },
    ],
  });
  if (!res.ok) {
    throw new ApiError(
      502,
      'Slack chat.postMessage failed',
      new Error(JSON.stringify(res)),
    );
  }

  return new Response(null, {status: 204});
}
