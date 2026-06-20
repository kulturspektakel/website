import {thumbHashToDataURL} from 'thumbhash';

export type ImmichAsset = {
  id: string;
  width: number;
  height: number;
  thumbhash: string | null;
};

export const IMMICH_BASE_URL = 'https://fotos.kulturspektakel.de';

/**
 * Decodes Immich's base64-encoded thumbhash into a tiny PNG data URL usable as a
 * blurry placeholder background. Returns null if the value is missing/invalid.
 */
export function thumbhashToDataUrl(thumbhash: string | null): string | null {
  if (!thumbhash) {
    return null;
  }
  try {
    const binary = atob(thumbhash);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}

export function immichSlugFromShareUrl(shareUrl: string): string | null {
  try {
    const url = new URL(shareUrl);
    const match = url.pathname.match(/\/s\/([^/]+)\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export function immichImageUrl(
  slug: string,
  assetId: string,
  variant: 'thumbnail' | 'preview',
): string {
  const url = new URL(`${IMMICH_BASE_URL}/api/assets/${assetId}/thumbnail`);
  url.searchParams.set('slug', slug);
  if (variant === 'preview') {
    url.searchParams.set('size', 'preview');
  }
  return url.toString();
}
