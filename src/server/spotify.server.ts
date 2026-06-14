// Authenticated Spotify Web API access (client-credentials flow). Used by the
// `spotify-image` task and the band-application search server fn.

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

// Resolves Spotify artist ids to their smallest profile picture url, batching
// the `/v1/artists` endpoint (50 ids max per call). Returns a map of id ->
// image url; ids without an image are absent. Unlike Instagram, Spotify image
// urls are content-addressed (no expiry), so they're safe to cache.
export async function fetchSpotifyArtistImages(
  artistIds: string[],
): Promise<Map<string, string>> {
  const images = new Map<string, string>();
  if (artistIds.length === 0) {
    return images;
  }
  const accessToken = await getSpotifyToken();
  for (let i = 0; i < artistIds.length; i += 50) {
    const batch = artistIds.slice(i, i + 50);
    const res = await fetch(
      `https://api.spotify.com/v1/artists?ids=${batch.join(',')}`,
      {headers: {Authorization: `Bearer ${accessToken}`}},
    );
    if (res.status === 429) {
      throw new Error('Spotify API limit reached');
    } else if (res.status === 401) {
      throw new Error('Spotify API token expired');
    } else if (res.status !== 200) {
      throw new Error(`Spotify API returned ${res.status}`);
    }
    const json: {
      artists: Array<{id: string; images: Array<{url: string}>} | null>;
    } = await res.json();
    for (const artist of json.artists) {
      const url = artist?.images.at(-1)?.url;
      if (artist && url) {
        images.set(artist.id, url);
      }
    }
  }
  return images;
}
