import {and, inArray, isNotNull, sql} from 'drizzle-orm';
import {db} from './db.server';
import {directusFiles} from './db/directus';
import {DirectusImage} from '../utils/directusImage';

export async function directusImages(
  ids: Array<string | null | undefined>,
): Promise<Record<string, DirectusImage>> {
  if (!ids.length) {
    return {};
  }
  const rows = await db
    .select({
      id: directusFiles.id,
      width: directusFiles.width,
      height: directusFiles.height,
      copyright: directusFiles.copyright,
      title: directusFiles.title,
    })
    .from(directusFiles)
    .where(
      and(
        // Compared as text: callers may pass ids that aren't uuids.
        inArray(sql`${directusFiles.id}::text`, ids),
        isNotNull(directusFiles.width),
        isNotNull(directusFiles.height),
      ),
    );
  const result: Record<string, DirectusImage> = {};
  for (const {width, height, ...image} of rows) {
    // Non-null: filtered above.
    result[image.id] = {...image, width: width!, height: height!};
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
