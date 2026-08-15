import {isAfter, isBefore, sub} from 'date-fns';
import {allItems, NuclinoApiError, user} from '../../server/nuclino.server';
import {sendMessage} from '../../server/slack.server';
import {SlackChannel} from '../../utils/slackChannels';

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/nuclinoUpdateMessage.ts`.
 *
 * Cron (every 10 min via Cloud Scheduler): announces recently-edited Nuclino
 * pages to #wiki.
 *
 * Best-effort: if the Nuclino API is temporarily unavailable (429/5xx) we log
 * and complete the run successfully rather than failing (and paging via Cloud
 * Scheduler). Missing one window of edits is acceptable for a #wiki notice.
 */

/** Ignore edits newer than this, so a burst collapses into one notification. */
const SETTLE_MINUTES = 5;

/**
 * Must match `schedule` on `nuclino_update_message` in terraform/production.tf.
 *
 * Each run looks at `[now - SETTLE - PERIOD, now - SETTLE]`, so the window is
 * exactly one cron period wide and consecutive runs tile the timeline end to
 * end — no gaps (missed edits) and no overlap (duplicate posts, since nothing
 * here dedupes). Changing the cron period without changing this constant
 * silently drops every edit that falls in the resulting gap.
 */
const CRON_PERIOD_MINUTES = 10;

/**
 * Cap per run, so a mass edit doesn't flood #wiki. Scales with the window: at a
 * 10-minute period a run can see twice what the old 5-minute one did.
 */
const MAX_ITEMS_PER_RUN = 6;
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

  // One `now` for both bounds, so the window can't skew mid-filter.
  const now = new Date();
  const windowEnd = sub(now, {minutes: SETTLE_MINUTES});
  const windowStart = sub(windowEnd, {minutes: CRON_PERIOD_MINUTES});

  const updatedItems = items
    .filter(
      (r) =>
        r.object === 'item' &&
        isAfter(new Date(r.lastUpdatedAt), windowStart) &&
        isBefore(new Date(r.lastUpdatedAt), windowEnd),
    )
    .slice(0, MAX_ITEMS_PER_RUN);

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
