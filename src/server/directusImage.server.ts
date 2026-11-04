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

export async function directusImage(id: string | null | undefined) {
  if (!id) {
    return null;
  }
  const images = await directusImages([id]);
  return images[id] || null;
}
