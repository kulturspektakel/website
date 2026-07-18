import {formatDistanceToNow, sub} from 'date-fns';
import {de} from 'date-fns/locale';
import {fetchUser} from '../slack.server';
import {upsertViewer} from '../upsertViewer.server';
import {configString} from '../owntracks';
import {prismaClient} from '../prismaClient.server';

/** Extracts a Slack user id from an escaped mention like `<@U012ABC|name>`. */
function taggedUserId(text: string): string | undefined {
  return text.match(/<@([A-Z0-9]+)(?:\|[^>]*)?>/)?.[1];
}

/**
 * Reply for `/location @user`: the tagged user's most recent shared location
 * (within the last 24h) as a Google Maps link plus a relative "last seen" time.
 * `ViewerLocation.viewerId` is the Slack user id, so we can look it up directly.
 * Slack renders `<@id>` as the display name, so no `fetchUser` is needed.
 */
async function locationResponse(userId: string): Promise<Response> {
  const loc = await prismaClient.viewerLocation.findFirst({
    where: {viewerId: userId, createdAt: {gt: sub(new Date(), {days: 1})}},
    orderBy: {createdAt: 'desc'},
  });

  if (!loc) {
    return Response.json({
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `<@${userId}> hat in den letzten 24 Stunden keinen Standort geteilt.`,
          },
        },
      ],
    });
  }

  const mapsUrl = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
  const relative = formatDistanceToNow(loc.createdAt, {
    addSuffix: true,
    locale: de,
  });

  return Response.json({
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📍 <@${userId}> war <${mapsUrl}|hier> – zuletzt gesehen ${relative}.`,
        },
      },
    ],
  });
}

/**
 * Migrated from `~/api.kulturspektakel.de/src/routes/slack/owntracks.ts`.
 * Handles the `/owntracks` and `/location` slash commands (both post here):
 * with a tagged user (`/location @user`) it returns that user's most recent
 * location; otherwise it returns install instructions + a deep-link that
 * imports the per-user OwnTracks device config.
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

  // `/location @user` (and `/owntracks @user`) look up the tagged user's
  // location; without a mention we fall through to the setup instructions.
  const tagged = taggedUserId(String(form.get('text') ?? ''));
  if (tagged) {
    return locationResponse(tagged);
  }

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
