import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {bandApplication} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {fetchSpotifyArtistImage} from '../../server/spotify.server';

export type SpotifyImagePayload = {id: string};

/**
 * Triggered after a band application is created (when it has a linked Spotify
 * artist): resolves the artist's profile picture via the Spotify Web API and
 * caches the url on the BandApplication so the booking table can read it
 * directly. A missing image is a no-op (we just keep the initials fallback).
 */
export async function handleSpotifyImage(request: Request): Promise<Response> {
  const {id} = await readJsonPayload<SpotifyImagePayload>(request);

  const application = await db.query.bandApplication.findFirst({
    where: eq(bandApplication.id, id),
  });
  if (!application?.spotifyArtist) {
    return new Response(null, {status: 204});
  }

  const imageUrl = await fetchSpotifyArtistImage(application.spotifyArtist);
  if (imageUrl) {
    await db
      .update(bandApplication)
      .set({imageUrl})
      .where(eq(bandApplication.id, id));
  }

  return new Response(null, {status: 204});
}
