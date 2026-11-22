import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {crewCardHolder} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {slackApiRequest} from '../../server/slack.server';
import {ApiError} from '../../server/apiError.server';
import {SlackChannel} from '../../utils/slackChannels';
import {
  byteArrayToString,
  formatLastValidDay,
  formatSerial,
} from '../../utils/cardUtils';

export type CrewCardEnrolledPayload = {
  crewCardId: number[];
  validUntil: string;
  /** Set when the chip had a live card, which the enrollment renewed. */
  renewedForHolderId?: string;
};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/crewCardEnrolled.ts`
 * (which delegated to `sendCrewCardEnrollmentMessage`). Triggered from
 * `kultcash.ts` after a CrewCard enrollment is upserted: announces the
 * activation in #crewcards with a "Karte zuordnen" button. A renewed card (the
 * chip had a live card, which keeps its holder) is announced as such, with a
 * button to assign it to someone else instead.
 *
 * The button (`assign-crew-card-modal`) is still served by the legacy api's
 * Slack interactivity webhook — only the message dispatch has moved here.
 */
export async function handleCrewCardEnrolled(
  request: Request,
): Promise<Response> {
  const {crewCardId, validUntil, renewedForHolderId} =
    await readJsonPayload<CrewCardEnrolledPayload>(request);

  const cardId = formatSerial(byteArrayToString(Uint8Array.from(crewCardId)));
  const formattedDate = formatLastValidDay(new Date(validUntil));

  const holder = renewedForHolderId
    ? await db.query.crewCardHolder.findFirst({
        where: eq(crewCardHolder.id, renewedForHolderId),
        columns: {viewerId: true, nickname: true},
      })
    : undefined;
  const message = holder
    ? {
        text: `CrewCard ${cardId} wurde verlängert`,
        section: `CrewCard \`${cardId}\` für ${holder.viewerId ? `<@${holder.viewerId}>` : `_${holder.nickname}_`} bis einschließlich ${formattedDate} verlängert`,
        button: 'Andere Person zuordnen',
      }
    : {
        text: `CrewCard ${cardId} wurde aktiviert`,
        section: `CrewCard \`${cardId}\` wurde bis einschließlich ${formattedDate} aktiviert`,
        button: 'Karte zuordnen',
      };

  const res = await slackApiRequest('chat.postMessage', {
    channel: SlackChannel.crewcards,
    text: message.text,
    blocks: [
      {
        type: 'section',
        text: {type: 'mrkdwn', text: message.section},
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {type: 'plain_text', text: message.button, emoji: true},
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
