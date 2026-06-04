import {subDays} from 'date-fns';
import {prismaClient} from '../prismaClient.server';
import {
  fetchUser,
  postResponseUrl,
  slackApiRequest,
} from '../slack.server';
import {upsertViewer} from '../upsertViewer.server';

/**
 * Migrated from `~/api.kulturspektakel.de/src/utils/crewCardEnrollment.ts`
 * (the announcement message lives in `tasks.crew-card-enrolled.ts`). Handles the
 * Slack interactivity for assigning a CrewCard to a person: opening the modal and
 * persisting the assignment.
 */
export async function showCrewCardAssignmentModal(
  cardId: string,
  triggerId: string,
  responseUrl: string,
) {
  const response = await slackApiRequest('views.open', {
    trigger_id: triggerId,
    view: {
      callback_id: 'assign-crew-card',
      private_metadata: JSON.stringify({responseUrl, cardId}),
      type: 'modal',
      title: {type: 'plain_text', text: 'CrewCard zuordnen', emoji: true},
      submit: {type: 'plain_text', text: 'OK', emoji: true},
      close: {type: 'plain_text', text: 'Abbrechen', emoji: true},
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Die CrewCard \`${cardId}\` muss einer Person zugeordnet werden.`,
          },
        },
        {
          type: 'section',
          text: {type: 'mrkdwn', text: '*Slack-User:*'},
          accessory: {
            type: 'users_select',
            placeholder: {type: 'plain_text', text: 'User', emoji: true},
            action_id: 'users_select-action',
          },
        },
        {
          type: 'input',
          optional: true,
          element: {
            type: 'plain_text_input',
            action_id: 'crew-card-holder-name',
            placeholder: {
              type: 'plain_text',
              text: 'Vorname Nachname',
              emoji: true,
            },
          },
          label: {
            type: 'plain_text',
            text: 'oder Person ohne Slack-Account:',
            emoji: true,
          },
        },
      ],
    },
  });

  if (!response.ok) {
    console.error(response);
    throw new Error(response.error);
  }
}

export async function assignCrewCard(
  slackUserId: string | undefined,
  nonSlackUser: string | undefined,
  assignedByUserId: string,
  privateMetadata: string,
) {
  if (!slackUserId && !nonSlackUser) {
    throw new Error('No user provided');
  }

  const {responseUrl, cardId}: {responseUrl: string; cardId: string} =
    JSON.parse(privateMetadata);

  let viewerId: string | null = null;
  let nickname: string | null = null;
  if (slackUserId) {
    // Website `upsertViewer` needs the full Slack user, so fetch it first
    // (legacy passed just the id).
    const slackUser = await fetchUser(slackUserId);
    if (!slackUser) {
      throw new Error('Slack user not found');
    }
    const viewer = await upsertViewer(slackUser);
    viewerId = viewer.id;
  } else if (nonSlackUser) {
    nickname = nonSlackUser;
  }

  const cardIdBytes = new Uint8Array(
    cardId.split(':').map((part) => parseInt(part, 16)),
  );

  const previousCards = await prismaClient.crewCard.updateManyAndReturn({
    where: {
      ...(viewerId ? {viewerId} : {nickname}),
      suspended: {not: true},
      id: {not: cardIdBytes},
    },
    data: {suspended: true},
  });

  const crewCard = await prismaClient.crewCard.update({
    where: {id: cardIdBytes},
    data: {viewerId, nickname},
  });

  const formattedDate = subDays(crewCard.validUntil, 1).toLocaleDateString(
    'de-DE',
    {
      weekday: 'long',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Europe/Berlin',
    },
  );

  let text = `<@${assignedByUserId}> hat die CrewCard \`${cardId}\` ${slackUserId ? `<@${slackUserId}>` : `_${nonSlackUser}_`} zugeordnet. Gültig bis einschließlich ${formattedDate}.`;
  if (previousCards.length > 0) {
    text += '\nDie alte CrewCard für diese Person wurde deaktiviert.';
  }

  await postResponseUrl(responseUrl, {
    replace_original: 'true',
    text: `CrewCard \`${cardId}\` erfolgreich zugeordnet`,
    blocks: [{type: 'section', text: {type: 'mrkdwn', text}}],
  });
}
