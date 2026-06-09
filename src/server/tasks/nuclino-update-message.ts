import {isAfter, isBefore, sub} from 'date-fns';
import {allItems, NuclinoApiError, user} from '../../server/nuclino.server';
import {sendMessage} from '../../server/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/nuclinoUpdateMessage.ts`.
 *
 * Cron (every 5 min via Cloud Scheduler): announces Nuclino pages edited in the
 * last 5–10 minutes to #wiki. The lower bound (≥5 min ago) lets a burst of edits
 * settle into one notification; capped at 3 to avoid spamming.
 *
 * Best-effort: if the Nuclino API is temporarily unavailable (429/5xx) we log
 * and complete the run successfully rather than failing (and paging via Cloud
 * Scheduler). Missing one window of edits is acceptable for a #wiki notice.
 */
export async function handleNuclinoUpdateMessage(): Promise<Response> {
  let items: Awaited<ReturnType<typeof allItems>>;
  try {
    items = await allItems();
  } catch (e) {
    if (e instanceof NuclinoApiError && e.isUnavailable) {
      console.warn(`Skipping Nuclino update: ${e.message}`);
      return new Response(null, {status: 204});
    }
    throw e;
  }

  const updatedItems = items
    .filter(
      (r) =>
        r.object === 'item' &&
        isAfter(new Date(r.lastUpdatedAt), sub(new Date(), {minutes: 10})) &&
        isBefore(new Date(r.lastUpdatedAt), sub(new Date(), {minutes: 5})),
    )
    .slice(0, 3);

  await Promise.all(
    updatedItems.map(async (item) => {
      let lastUpdatedUser;
      try {
        lastUpdatedUser = await user(item.lastUpdatedUserId);
      } catch (e) {
        if (e instanceof NuclinoApiError && e.isUnavailable) {
          console.warn(`Skipping ${item.title}: ${e.message}`);
          return;
        }
        throw e;
      }
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
