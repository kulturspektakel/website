import {fetchUser} from '../slack.server';
import {upsertViewer} from '../upsertViewer.server';
import {configString} from '../owntracks';

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/owntracks.ts`.
 * The `/owntracks` slash command: returns install instructions + a deep-link
 * that imports the per-user OwnTracks device config.
 *
 * Step 2 (enable "Allow external configuration") is unavoidable: OwnTracks iOS
 * ≥26.2.3 disables config import via URL/file by default (security advisory),
 * and gates every import path behind that one setting. It's a one-time,
 * per-device toggle, so we spell out the exact path rather than work around it.
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
  const configUrl = `${process.env.SITE_URL}/api/owntracks/config?config=${configString(viewer)}`;

  return Response.json({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Standort mit OwnTracks teilen*\n\n*1.* App installieren: <https://apps.apple.com/de/app/owntracks/id692424691|iPhone> oder <https://play.google.com/store/apps/details?id=org.owntracks.android|Android>\n*2.* _Einmalig (iPhone):_ Konfiguration per Link erlauben – in der App auf *ℹ️* → *Settings* → *Remote control* tippen und „*Allow external configuration*" einschalten (die Warnung mit *OK* bestätigen).\n*3.* Diesen <${configUrl}|Link> antippen, um OwnTracks zu konfigurieren.\n*4.* Nach dem Standort fragt die App automatisch – damit dein Standort auch im Hintergrund geteilt wird, unter *Einstellungen → OwnTracks → Standort* auf *„Immer"* stellen und *„Genauer Standort"* aktivieren. Fertig! ✅`,
        },
      },
    ],
  });
}
