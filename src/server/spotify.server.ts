// Authenticated Spotify Web API access (client-credentials flow). Used by the
// `spotify-image` task and the band-application search server fn.

import {isValidSpotifyArtistId} from '../utils/spotifyArtistId';

let token: {access_token: string; expiresAt: number} | null = null;

export async function getSpotifyToken() {
  if (token && token.expiresAt > Date.now()) {
    return token.access_token;
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
      ).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (res.status !== 200) {
    throw new Error(`Could not get Spotify token (${res.status})`);
  }
  const json: {access_token: string; expires_in: number} = await res.json();
  // Refresh a minute early so an in-flight request never uses a stale token.
  token = {
    access_token: json.access_token,
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  };
  return token.access_token;
}

// Resolves a Spotify artist id to its smallest profile picture url, or null if
// the artist has no image. Unlike Instagram, Spotify image urls are
// content-addressed (no expiry), so they're safe to cache.
//
// This used to batch ids through `/v1/artists?ids=`, but Spotify removed the
// batch-fetch endpoints from Development Mode apps in February 2026 (it now
// returns 403), so we fetch one artist at a time.
export async function fetchSpotifyArtistImage(
  artistId: string,
): Promise<string | null> {
  if (!isValidSpotifyArtistId(artistId)) {
    return null;
  }
  const accessToken = await getSpotifyToken();
  const res = await fetch(
    `https://api.spotify.com/v1/artists/${encodeURIComponent(artistId)}`,
    {headers: {Authorization: `Bearer ${accessToken}`}},
  );
  if (res.status === 404) {
    // Artist was removed or the stored id is stale — nothing to cache, and
    // retrying won't help, so this isn't an error.
    return null;
  } else if (res.status === 429) {
    throw new Error('Spotify API limit reached');
  } else if (res.status === 401) {
    throw new Error('Spotify API token expired');
  } else if (res.status !== 200) {
    throw new Error(`Spotify API returned ${res.status}`);
  }
  const json: {images?: Array<{url: string}>} = await res.json();
  return json.images?.at(-1)?.url ?? null;
}
