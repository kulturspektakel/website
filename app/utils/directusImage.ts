import {Prisma} from '@prisma/client';
import {prismaClient} from './prismaClient';

export type DirectusImage = {
  id: string;
  width: number;
  height: number;
  copyright: string;
  title: string;
};

export async function directusImages(
  ids: Array<string | null | undefined>,
): Promise<Record<string, DirectusImage>> {
  if (!ids.length) {
    return Promise.resolve({});
  }
  const images = await prismaClient.$queryRaw<
    Array<DirectusImage>
  >`SELECT id, width, height, copyright, title FROM "directus"."directus_files" WHERE id::text IN (${Prisma.join(
    ids,
  )}) AND width IS NOT NULL AND height IS NOT NULL`;
  const result: Record<string, DirectusImage> = {};
  for (const image of images) {
    result[image.id] = image;
  }
  return Promise.resolve(result);
}

export async function directusImageConnection(
  connectionName: string,
  id: string,
  limit = 20,
  offset = 0,
) {
  const valid = /^[A-Za-z0-9_-]+$/;
  if (!valid.test(connectionName)) {
    throw new Error('Invalid connection name');
  }
  if (!valid.test(id)) {
    throw new Error('Invalid id');
  }

  const from = `"directus"."${connectionName}_files"
  JOIN "directus"."directus_files" ON "directus_files_id" = "directus"."directus_files"."id"
  WHERE "${connectionName}_id" = '${id}'`;
  const [{count}] = await prismaClient.$queryRawUnsafe<[{count: BigInt}]>(
    `SELECT COUNT(*) FROM ${from};`,
  );
  const files = await prismaClient.$queryRawUnsafe<[DirectusImage]>(
    `SELECT * FROM ${from} ORDER BY "filename_download" LIMIT ${limit} OFFSET ${offset};`,
  );

  return {
    files,
    totalCount: Number(count),
  };
}

export const BASE_URL = 'https://files.kulturspektakel.de/';

export function imageUrl(
  id: string,
  options?: {width: number} | {height: number},
): string;
export function imageUrl(
  id?: string | null,
  options?: {width: number} | {height: number},
): string | null;
export function imageUrl(
  id?: string | null,
  options?: {width: number} | {height: number},
) {
  if (!id) {
    return null;
  }
  const url = new URL(BASE_URL);
  url.pathname = id;
  if (options?.width) {
    url.searchParams.append('width', String(options.width));
  } else if (options?.height) {
    url.searchParams.append('height', String(options.height));
  }
  return url.toString();
}

export async function directusImage(id: string | null | undefined) {
  if (!id) {
    return Promise.resolve(null);
  }
  const images = await directusImages([id]);
  return images[id] || null;
}
