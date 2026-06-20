import {
  IMMICH_BASE_URL,
  immichSlugFromShareUrl,
  type ImmichAsset,
} from '../utils/immich';

/**
 * Resolves a public Immich shared-album URL (e.g.
 * `https://fotos.kulturspektakel.de/s/BeatsImBad`) into its image assets.
 *
 * The share slug works as a plain `?slug=` query param on the public Immich API
 * (no auth/API key), so the resulting asset thumbnails can be loaded directly by
 * the browser via `immichImageUrl`.
 *
 * Returns `null` on any failure (missing/invalid URL, non-album share, network or
 * non-2xx response) so callers can fall back to the existing Directus gallery.
 */
export async function immichAlbumAssets(
  shareUrl: string,
  limit?: number,
): Promise<{slug: string; assets: ImmichAsset[]; totalCount: number} | null> {
  const slug = immichSlugFromShareUrl(shareUrl);
  if (!slug) {
    return null;
  }

  try {
    // 1. Resolve the share slug to the underlying album id.
    const linkRes = await fetch(
      `${IMMICH_BASE_URL}/api/shared-links/me?slug=${encodeURIComponent(slug)}`,
    );
    if (!linkRes.ok) {
      return null;
    }
    const link = (await linkRes.json()) as {
      type?: string;
      album?: {id?: string};
    };
    const albumId = link.album?.id;
    if (link.type !== 'ALBUM' || !albumId) {
      return null;
    }

    // 2. Fetch the album with its assets.
    const albumRes = await fetch(
      `${IMMICH_BASE_URL}/api/albums/${albumId}?slug=${encodeURIComponent(slug)}`,
    );
    if (!albumRes.ok) {
      return null;
    }
    const album = (await albumRes.json()) as {
      assets?: Array<{
        id: string;
        type: string;
        width: number;
        height: number;
        thumbhash: string | null;
      }>;
    };

    const images = (album.assets ?? [])
      .filter((a) => a.type === 'IMAGE')
      .map(({id, width, height, thumbhash}) => ({id, width, height, thumbhash}));

    return {
      slug,
      assets: limit != null ? images.slice(0, limit) : images,
      totalCount: images.length,
    };
  } catch {
    return null;
  }
}
