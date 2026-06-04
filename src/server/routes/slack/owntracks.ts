import {fetchUser} from '../../../utils/slack.server';
import {upsertViewer} from '../../../utils/upsertViewer.server';
import {configString} from '../owntracks';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/owntracks.ts`.
 * The `/owntracks` slash command: returns install instructions + a deep-link
 * that imports the per-user OwnTracks device config.
 */
export async function handleOwnTracksCommand(
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const userId = String(form.get('user_id') ?? '');

  const slackUser = await fetchUser(userId);
  if (!slackUser) {
    throw new Error('Slack user not found');
  }
  const viewer = await upsertViewer(slackUser);
  const configUrl = `${process.env.SITE_URL}/owntracks/config?config=${configString(viewer)}`;

  return Response.json({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\n1. *OwnTracks* herunterladen: <https://apps.apple.com/de/app/owntracks/id692424691|iPhone> oder <https://play.google.com/store/apps/details?id=org.owntracks.android|Android>\n2. Diesen <${configUrl}|Link> anklicken um die App zu konfigurieren`,
        },
      },
    ],
  });
}
