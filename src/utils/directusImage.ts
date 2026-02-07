export type DirectusImage = {
  id: string;
  width: number;
  height: number;
  copyright: string;
  title: string;
};

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
  if (options && 'width' in options) {
    url.searchParams.append('width', String(options.width));
  } else if (options && 'height' in options) {
    url.searchParams.append('height', String(options.height));
  }
  return url.toString();
}
