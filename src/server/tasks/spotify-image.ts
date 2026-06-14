import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {fetchSpotifyArtistImages} from '../../server/spotify.server';

export type SpotifyImagePayload = {id: string};

/**
 * Triggered after a band application is created (when it has a linked Spotify
 * artist): resolves the artist's profile picture via the Spotify Web API and
 * caches the url on the BandApplication so the booking table can read it
 * directly. A missing image is a no-op (we just keep the initials fallback).
 */
export async function handleSpotifyImage(request: Request): Promise<Response> {
  const {id} = await readJsonPayload<SpotifyImagePayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  if (!application?.spotifyArtist) {
    return new Response(null, {status: 204});
  }

  const images = await fetchSpotifyArtistImages([application.spotifyArtist]);
  const imageUrl = images.get(application.spotifyArtist);
  if (imageUrl) {
    await prismaClient.bandApplication.update({where: {id}, data: {imageUrl}});
  }

  return new Response(null, {status: 204});
}
