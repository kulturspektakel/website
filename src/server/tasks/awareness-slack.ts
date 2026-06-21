import {readJsonPayload} from '../../server/readJsonPayload.server';
import {sendMessage} from '../slack.server';
import {SlackChannel} from '../../utils/slackChannels';

export type AwarenessSlackPayload = {
  name: string;
  phone: string;
  message?: string;
  // Google Maps link (or "lat,lng") from the browser's geolocation.
  location?: string;
};

/**
 * Notify the awareness team on Slack about a help request, with a Google Maps
 * link for the location. Separate from the Twilio call task so a Slack failure
 * retries independently and never blocks (or duplicates) the phone call.
 * Throws on failure so Cloud Tasks retries.
 */
export async function handleAwarenessSlack(
  request: Request,
): Promise<Response> {
  const data = await readJsonPayload<AwarenessSlackPayload>(request);

  const mapsLink = data.location
    ? data.location.startsWith('http')
      ? data.location
      : `https://www.google.com/maps?q=${encodeURIComponent(data.location)}`
    : null;

  await sendMessage({
    channel: SlackChannel.awareness,
    username: 'Awareness',
    icon_emoji: ':sos:',
    text: [
      ':rotating_light: <!subteam^S0BBZMX1RB7> *Neue Hilfe-Anfrage über die Website*',
      `*Name:* ${data.name}`,
      `*Telefon:* <tel:${data.phone.replace(/\s/g, '')}|${data.phone}>`,
      data.message ? `*Anliegen:* ${data.message}` : undefined,
      mapsLink ? `*Standort:* <${mapsLink}|Auf Karte öffnen>` : undefined,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return new Response(null, {status: 204});
}
