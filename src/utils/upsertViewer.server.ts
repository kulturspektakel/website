import {sub} from 'date-fns';
import {prismaClient} from './prismaClient.server';
import {fetchUser} from './slack.server';

/**
 * Ensure a `Viewer` row exists for the given Slack user id, refreshing its
 * displayName/email/avatar from the Slack API if the row is older than 30
 * days (or doesn't exist yet). Ported from
 * `~/api.kulturspektakel.de/src/utils/upsertViewer.ts`.
 */
export async function upsertViewer(viewerId: string, context?: string) {
  if (viewerId.length === 36) {
    console.log(`[upsertViewer] UUID detected ${viewerId}: ${context}`);
  }
  const existing = await prismaClient.viewer.findUnique({
    where: {id: viewerId},
  });
  const daysAgo = sub(new Date(), {days: 30});
  if (existing && existing.updatedAt < daysAgo) {
    return existing;
  }

  const slackUser = await fetchUser(viewerId);
  if (!slackUser) {
    throw new Error(`Slack user not found for id ${viewerId}`);
  }
  const data = {
    displayName: slackUser.profile.real_name,
    profilePicture: slackUser.profile.image_192,
    email: slackUser.profile.email,
  };
  return prismaClient.viewer.upsert({
    where: {id: slackUser.id},
    create: {id: slackUser.id, ...data},
    update: data,
  });
}
