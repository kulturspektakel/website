import {isAfter, isBefore, sub} from 'date-fns';
import {allItems, user} from '../../utils/nuclino.server';
import {sendMessage} from '../../utils/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/nuclinoUpdateMessage.ts`.
 *
 * Cron (every 5 min via Cloud Scheduler): announces Nuclino pages edited in the
 * last 5–10 minutes to #wiki. The lower bound (≥5 min ago) lets a burst of edits
 * settle into one notification; capped at 3 to avoid spamming.
 */
export async function handleNuclinoUpdateMessage(): Promise<Response> {
  const updatedItems = (await allItems())
    .filter(
      (r) =>
        r.object === 'item' &&
        isAfter(new Date(r.lastUpdatedAt), sub(new Date(), {minutes: 10})) &&
        isBefore(new Date(r.lastUpdatedAt), sub(new Date(), {minutes: 5})),
    )
    .slice(0, 3);

  await Promise.all(
    updatedItems.map(async (item) => {
      const lastUpdatedUser = await user(item.lastUpdatedUserId);
      const url = item.url.replace(
        'https://app.nuclino.com/t/',
        'https://app.nuclino.com/Kulturspektakel/',
      );
      return sendMessage({
        channel: SlackChannel.wiki,
        text: `<${url}|${item.title}> von ${lastUpdatedUser.firstName} ${lastUpdatedUser.lastName} aktualisiert`,
        unfurl_links: false,
      });
    }),
  );

  return new Response(null, {status: 204});
}
