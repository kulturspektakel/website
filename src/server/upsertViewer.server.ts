import {db} from './db.server';
import {viewer} from './db/schema';
import type {SlackApiUser} from './slack.server';

/**
 * Idempotently materialize a `Viewer` row for a Slack user we've already
 * fetched. Used by the nuclino-sso task once it's looked the user up via
 * `users.lookupByEmail` — that call's payload is plenty to upsert, so this
 * doesn't re-fetch the user.
 */
export async function upsertViewer(slackUser: SlackApiUser) {
  const data = {
    displayName: slackUser.profile.real_name,
    profilePicture: slackUser.profile.image_192,
    email: slackUser.profile.email,
  };
  const [row] = await db
    .insert(viewer)
    .values({id: slackUser.id, ...data})
    .onConflictDoUpdate({target: viewer.id, set: data})
    .returning();
  return row;
}
