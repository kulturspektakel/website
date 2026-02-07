import {createServerFn} from '@tanstack/react-start';

let TOKEN: {
  access_token: string;
  token_type: string;
  expires_in: number;
} | null = null;

async function getSpotifyToken() {
  if (TOKEN && TOKEN.expires_in > Date.now() / 1000) {
    return TOKEN;
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

  TOKEN = await res.json();
  return TOKEN;
}

export const getSpotifyArtists = createServerFn()
  .inputValidator((data: string) => data)
  .handler(async ({data: query}) => {
    const token = await getSpotifyToken();
    if (!token) {
      throw new Error('Could not get Spotify token');
    }
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(
        query,
      )}&type=artist&market=DE&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
        },
      },
    );

    if (res.status === 429) {
      throw new Error('Spotify API limit reached');
    } else if (res.status === 401) {
      throw new Error('Spotify API token expired');
    } else if (res.status !== 200) {
      throw new Error(`Spotify API returned ${res.status}`);
    }

    const json: {
      artists: {
        href: string;
        items: Array<{
          external_urls: {
            spotify: string;
          };
          genres: string[];
          href: string;
          id: string;
          images: Array<{
            height: number;
            url: string;
            width: number;
          }>;
          name: string;
          popularity: number;
          type: string;
          uri: string;
        }>;
        limit: number;
        next: string;
        offset: number;
        previous: null;
        total: number;
      };
    } = await res.json();

    return json.artists.items.map((artist) => ({
      name: artist.name,
      id: artist.id,
      image: artist.images.at(artist.images.length - 1)?.url ?? null,
      genre: artist.genres.at(0) ?? null,
    }));
  });
