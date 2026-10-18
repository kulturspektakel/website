import {sql} from 'drizzle-orm';
import {db} from './db.server';
import {viewer} from './db/schema';

export type CrewViewer = {
  id: string;
  displayName: string;
  profilePicture: string | null;
};

/**
 * Resolve a Directus user to their Slack-keyed `Viewer` — the identity all crew
 * data (ratings, comments, tags, …) is keyed on — provisioning one the first
 * time we see a user that doesn't have one yet.
 *
 * The bridge is `directus_users.external_identifier`, which holds the Slack user
 * id and therefore equals `Viewer.id`. The Directus table lives in the
 * externally-owned `directus` Postgres schema, so it's read with raw SQL rather
 * than modeled (drizzle-kit only manages `public`; see drizzle.config.ts). Existing crew
 * already have a rich, Slack-sourced `Viewer`, so we only create for
 * genuinely-new users and never overwrite an existing row.
 *
 * Returns `null` when no Slack-keyed Viewer can be formed (the Directus account
 * has no `external_identifier`, e.g. it wasn't created via Slack SSO).
 */
export async function resolveCrewViewer(
  directusUserId: string,
): Promise<CrewViewer | null> {
  // This runs on every crew request (crewAuth), so the Directus user and their
  // Viewer come back in one round trip.
  const {
    rows: [du],
  } = await db.execute<{
    external_identifier: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    viewer_id: string | null;
    display_name: string | null;
    profile_picture: string | null;
  }>(sql`
    SELECT du.external_identifier, du.email, du.first_name, du.last_name,
           v.id AS viewer_id, v."displayName" AS display_name,
           v."profilePicture" AS profile_picture
      FROM "directus"."directus_users" du
      LEFT JOIN ${viewer} v ON v.id = du.external_identifier
     WHERE du.id = ${directusUserId}::uuid`);

  if (!du?.external_identifier) {
    return null; // no Slack identity → can't key a Viewer
  }
  const id = du.external_identifier; // == Viewer.id

  if (du.viewer_id) {
    // already exists — don't touch it
    return {
      id: du.viewer_id,
      displayName: du.display_name!,
      profilePicture: du.profile_picture,
    };
  }

  // First sight of this user: provision a minimal Viewer keyed by their Slack
  // id. On a race between concurrent first requests the insert skips, and the
  // row the other request created is read back.
  const displayName =
    [du.first_name, du.last_name].filter(Boolean).join(' ') ||
    du.email ||
    id;
  const columns = {
    id: viewer.id,
    displayName: viewer.displayName,
    profilePicture: viewer.profilePicture,
  };
  const [created] = await db
    .insert(viewer)
    .values({id, displayName, email: du.email ?? ''})
    .onConflictDoNothing()
    .returning(columns);
  return (
    created ??
    (await db.query.viewer.findFirst({
      where: (v, {eq}) => eq(v.id, id),
      columns: {id: true, displayName: true, profilePicture: true},
    }))!
  );
}
