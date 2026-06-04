import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';

export type SpotifyListenersPayload = {id: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/spotifyListeners.ts`.
 * Scrapes the public artist page for the monthly-listeners count and stores it
 * on the BandApplication. Throws (→ Cloud Tasks retry) when the page renders
 * but the count can't be found.
 */
export async function handleSpotifyListeners(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<SpotifyListenersPayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  if (!application?.spotifyArtist) {
    return new Response(null, {status: 204});
  }

  const url = `https://open.spotify.com/artist/${application.spotifyArtist}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP${res.status} ${res.statusText}: ${url}`);
  }

  const data = await res.text();
  const match = data.match(
    /data-testid="monthly-listeners-label">([0-9,]+) monthly/,
  );
  let spotifyMonthlyListeners: number | null = null;
  if (match && match.length > 0) {
    spotifyMonthlyListeners = parseInt(match[1].replace(/\D/g, ''), 10);
  } else if (data.includes(' 0 monthly listeners')) {
    spotifyMonthlyListeners = 0;
  }

  if (spotifyMonthlyListeners != null) {
    await prismaClient.bandApplication.update({
      where: {id},
      data: {spotifyMonthlyListeners},
    });
  } else {
    throw new Error(
      `Could not find monthly listeners for ${application.spotifyArtist}`,
    );
  }

  return new Response(null, {status: 204});
}
