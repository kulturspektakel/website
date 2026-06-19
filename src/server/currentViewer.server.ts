import {prismaClient} from './prismaClient.server';

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
 * externally-owned `directus` Postgres schema, so we read it with `$queryRaw`
 * rather than modeling it (modeling it would pull the schema under Prisma's
 * management and make `prisma db push` drop the Directus tables). Existing crew
 * already have a rich, Slack-sourced `Viewer`, so we only create for
 * genuinely-new users and never overwrite an existing row.
 *
 * Returns `null` when no Slack-keyed Viewer can be formed (the Directus account
 * has no `external_identifier`, e.g. it wasn't created via Slack SSO).
 */
export async function resolveCrewViewer(
  directusUserId: string,
): Promise<CrewViewer | null> {
  const rows = await prismaClient.$queryRaw<
    Array<{
      external_identifier: string | null;
      email: string | null;
      first_name: string | null;
      last_name: string | null;
    }>
  >`
    SELECT external_identifier, email, first_name, last_name
    FROM "directus"."directus_users"
    WHERE id = ${directusUserId}::uuid`;

  const du = rows[0];
  if (!du?.external_identifier) {
    return null; // no Slack identity → can't key a Viewer
  }
  const id = du.external_identifier; // == Viewer.id

  const existing = await prismaClient.viewer.findUnique({
    where: {id},
    select: {id: true, displayName: true, profilePicture: true},
  });
  if (existing) {
    return existing; // already exists — don't touch it
  }

  // First sight of this user: provision a minimal Viewer keyed by their Slack
  // id. `upsert` (not `create`) guards against a race between concurrent first
  // requests; the empty `update` leaves an already-created row untouched.
  const displayName =
    [du.first_name, du.last_name].filter(Boolean).join(' ') ||
    du.email ||
    id;
  return prismaClient.viewer.upsert({
    where: {id},
    create: {id, displayName, email: du.email ?? ''},
    update: {},
    select: {id: true, displayName: true, profilePicture: true},
  });
}
