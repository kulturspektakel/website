import {Prisma} from '@prisma/client';
import {prismaClient} from './prismaClient';

export type DirectusImage = {
  id: string;
  width: number;
  height: number;
  copyright: string;
  title: string;
};

export function directusImages(ids: string[]) {
  if (!ids.length) {
    return Promise.resolve([]);
  }
  return prismaClient.$queryRaw<
    Array<DirectusImage>
  >`SELECT id, width, height, copyright, title FROM "directus"."directus_files" WHERE id::text IN (${Prisma.join(
    ids,
  )}) AND width IS NOT NULL AND height IS NOT NULL`;
}

export function imageUrl(options?: {id: string; width?: number}) {
  const url = new URL('https://files.kulturspektakel.de/');
  if (options) {
    url.pathname = options.id;
  }
  if (options?.width) {
    url.searchParams.append('width', String(options.width));
  }
  return url.toString();
}
