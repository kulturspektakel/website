import {sql} from 'drizzle-orm';
import {db} from './db.server';
import {DirectusImage} from '../utils/directusImage';

// Directus' tables live in the `directus` schema of the same database and
// aren't part of the Drizzle schema, so these are raw queries.

export async function directusImages(
  ids: Array<string | null | undefined>,
): Promise<Record<string, DirectusImage>> {
  if (!ids.length) {
    return {};
  }
  const {rows} = await db.execute<DirectusImage>(sql`
    SELECT id, width, height, copyright, title
      FROM "directus"."directus_files"
     WHERE id::text IN (${sql.join(
       ids.map((id) => sql`${id}`),
       sql`, `,
     )})
       AND width IS NOT NULL AND height IS NOT NULL`);
  const result: Record<string, DirectusImage> = {};
  for (const image of rows) {
    result[image.id] = image;
  }
  return result;
}

export async function directusImageConnection(
  connectionName: string,
  id: string,
  limit = 20,
  offset = 0,
) {
  // The connection name ends up in table and column names, which can't be
  // query parameters, so it has to be validated instead.
  const valid = /^[A-Za-z0-9_-]+$/;
  if (!valid.test(connectionName)) {
    throw new Error('Invalid connection name');
  }
  if (!valid.test(id)) {
    throw new Error('Invalid id');
  }

  const from = sql`${sql.identifier('directus')}.${sql.identifier(`${connectionName}_files`)}
    JOIN "directus"."directus_files" ON "directus_files_id" = "directus"."directus_files"."id"
    WHERE ${sql.identifier(`${connectionName}_id`)} = ${id}`;
  const [{rows: counts}, {rows: files}] = await Promise.all([
    // COUNT(*) is a bigint, which arrives as a string.
    db.execute<{count: string}>(sql`SELECT COUNT(*) AS count FROM ${from}`),
    db.execute<DirectusImage>(
      sql`SELECT directus_files_id AS id, width, height, copyright, title
            FROM ${from}
           ORDER BY "filename_download"
           LIMIT ${limit} OFFSET ${offset}`,
    ),
  ]);

  return {
    files,
    totalCount: Number(counts[0].count),
  };
}

export async function directusImage(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  const images = await directusImages([id]);
  return images[id] || null;
}
