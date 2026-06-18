import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {sendMessage} from './slack.server';
import {SlackChannel} from '../utils/slackChannels';

/**
 * Help request submitted through the box on the public `/awareness` page.
 * Posts directly to the awareness Slack channel so the team is notified in
 * real time during the festival (low volume — no need for a background task).
 */
export const requestAwarenessHelp = createServerFn()
  .inputValidator(
    z.object({
      name: z.string().trim().min(1),
      phone: z.string().trim().min(1),
      message: z.string().trim().optional(),
      // Google Maps link (or "lat,lng") from the browser's geolocation.
      location: z.string().trim().optional(),
    }),
  )
  .handler(async ({data}) => {
    await sendMessage({
      // TODO: switch to SlackChannel.awareness once the real channel exists.
      channel: SlackChannel.dev,
      username: 'Awareness',
      icon_emoji: ':sos:',
      text: [
        ':rotating_light: *Neue Hilfe-Anfrage über die Website*',
        `*Name:* ${data.name}`,
        `*Telefon:* ${data.phone}`,
        data.message ? `*Anliegen:* ${data.message}` : undefined,
        data.location ? `*Standort:* ${data.location}` : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  });
