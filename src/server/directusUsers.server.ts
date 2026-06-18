import {Prisma} from '../generated/prisma/client';
import {prismaClient} from './prismaClient.server';

export type DirectusUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export async function directusUsers(
  ids: Array<string | null | undefined>,
): Promise<Record<string, DirectusUser>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) {
    return {};
  }
  const rows = await prismaClient.$queryRaw<Array<DirectusUser>>`
    SELECT id, first_name, last_name FROM "directus"."directus_users"
    WHERE id::text IN (${Prisma.join(unique)})`;
  return Object.fromEntries(rows.map((u) => [u.id, u]));
}
