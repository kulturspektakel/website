import bandcamp from 'bandcamp-scraper';
import {promisify} from 'util';
import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {DemoEmbedType} from '../../generated/prisma/browser';

export type BandApplicationDemoPayload = {id: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/bandApplicationDemo.ts`.
 * Resolves the applicant's demo link (YouTube / youtu.be / Bandcamp /
 * SoundCloud / Spotify) into an embeddable id + type stored on the
 * BandApplication.
 */
export async function handleBandApplicationDemo(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<BandApplicationDemoPayload>(request);

  const bandApplication = await prismaClient.bandApplication.findUniqueOrThrow({
    where: {id},
  });
  const demo = bandApplication.demo?.split(' ').shift();
  if (demo == null) {
    return new Response(null, {status: 204});
  }

  const url = new URL(demo);
  const domain = url.hostname.toLowerCase().split('.').slice(-2).join('.');
  let path = url.pathname.split('/');
  let demoEmbed: string | undefined = undefined;
  let demoEmbedType: DemoEmbedType = DemoEmbedType.Unresolvable;

  switch (domain) {
    case 'youtube.com':
      switch (path[1]) {
        case 'watch':
          demoEmbedType = DemoEmbedType.YouTubeVideo;
          demoEmbed = url.searchParams.get('v')?.toString();
          break;
        case 'user':
          demoEmbedType = DemoEmbedType.YouTubeVideo;
          demoEmbed = await youTubeVideoFor('forUsername', path[2]);
          break;
        case 'playlist':
          demoEmbedType = DemoEmbedType.YouTubePlaylist;
          demoEmbed = url.searchParams.get('list')?.toString();
          break;
        case 'channel':
          demoEmbed = await youTubeVideoForChannelId(path[2]);
          if (demoEmbed != null) {
            demoEmbedType = DemoEmbedType.YouTubeVideo;
          }
          break;
        case 'c':
          demoEmbed = await youTubeVideoFor('forHandle', path[2]);
          if (demoEmbed != null) {
            demoEmbedType = DemoEmbedType.YouTubeVideo;
          }
          break;
        case 'live':
          demoEmbed = path[2];
          demoEmbedType = DemoEmbedType.YouTubeVideo;
          break;
        default:
          if (path[1] != null) {
            demoEmbed = await youTubeVideoFor('forHandle', path[1]);
            if (demoEmbed != null) {
              demoEmbedType = DemoEmbedType.YouTubeVideo;
            }
          }
          break;
      }
      break;
    case 'youtu.be':
      demoEmbed = path[1];
      demoEmbedType = DemoEmbedType.YouTubeVideo;
      break;
    case 'bandcamp.com': {
      let albumUrl: string | undefined = url.toString();
      if (path[1] === 'track') {
        const track = await promisify(bandcamp.getTrackInfo)(albumUrl);
        if (track?.raw.id != null) {
          demoEmbed = track.raw.id.toString();
          demoEmbedType = DemoEmbedType.BandcampTrack;
          break;
        }
      } else if (path[1] !== 'album') {
        const match = url.hostname.match(/([^.]+)\.bandcamp\.com/i);
        if (match && match?.length > 1) {
          const artist = await promisify(bandcamp.getArtistInfo)(albumUrl);
          albumUrl = artist?.albums?.pop()?.url;
        }
      }

      if (albumUrl != null) {
        const album = await promisify(bandcamp.getAlbumInfo)(albumUrl);
        if (album?.raw.id) {
          demoEmbedType = DemoEmbedType.BandcampAlbum;
          demoEmbed = album.raw.id.toString();
        }
      }
      break;
    }
    case 'soundcloud.com': {
      let pathname = url.pathname;
      if (url.host === 'on.soundcloud.com') {
        const res = await fetch(url, {redirect: 'follow'});
        pathname = new URL(res.url).pathname;
      }
      demoEmbed = pathname;
      demoEmbedType = DemoEmbedType.SoundcloudUrl;
      break;
    }
    case 'spoti.fi': {
      const res = await fetch(url, {redirect: 'follow'});
      path = new URL(res.url).pathname.split('/');
      // Fallthrough
    }
    case 'spotify.com':
      if (path[1].match(/^intl-\w+$/gi)) {
        path.splice(1, 1);
      }
      switch (path[1]) {
        case 'artist':
          demoEmbedType = DemoEmbedType.SpotifyArtist;
          break;
        case 'album':
          demoEmbedType = DemoEmbedType.SpotifyAlbum;
          break;
        case 'track':
          demoEmbedType = DemoEmbedType.SpotifyTrack;
          break;
      }
      if (demoEmbedType !== DemoEmbedType.Unresolvable) {
        demoEmbed = path[2];
      }
      break;
  }

  await prismaClient.bandApplication.update({
    where: {id},
    data: {demoEmbed, demoEmbedType},
  });

  return new Response(null, {status: 204});
}

type YouTubeChannelListResponse = {
  pageInfo: {totalResults: number};
  items: Array<{
    id: string;
    brandingSettings: {channel: {unsubscribedTrailer?: string}};
  }>;
};

type YouTubeChannelSearchResponse = {
  items: Array<{id: {videoId: string}}>;
};

type YouTubeError = {error: {code: number; message: string}};

function isError(res: object | YouTubeError): res is YouTubeError {
  return 'error' in res;
}

async function youTubeVideoFor(
  forU: 'forUsername' | 'forHandle',
  value: string,
) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.append('key', process.env.YOUTUBE_API_KEY);
  url.searchParams.append('part', 'statistics,brandingSettings,contentDetails');
  url.searchParams.append(forU, value);

  const res: YouTubeChannelListResponse | YouTubeError = await fetch(url).then(
    (res) => res.json(),
  );
  if (isError(res)) {
    throw new Error(res.error.message);
  }
  if (res.pageInfo.totalResults === 0) {
    return;
  }

  const unsubscribedTrailer =
    res.items[0].brandingSettings.channel.unsubscribedTrailer;
  if (unsubscribedTrailer) {
    return unsubscribedTrailer;
  }
  return youTubeVideoForChannelId(res.items[0].id);
}

async function youTubeVideoForChannelId(channelId: string | undefined) {
  if (!channelId) {
    return;
  }
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.append('key', process.env.YOUTUBE_API_KEY);
  url.searchParams.append('part', 'snippet');
  url.searchParams.append('maxResults', '1');
  url.searchParams.append('order', 'viewCount');
  url.searchParams.append('type', 'video');
  url.searchParams.append('channelId', channelId);

  const res: YouTubeChannelSearchResponse | YouTubeError = await fetch(
    url,
  ).then((res) => res.json());
  if (isError(res)) {
    throw new Error(res.error.message);
  }
  if (res.items.length > 0) {
    return res.items[0].id.videoId;
  }
}
