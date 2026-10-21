import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {bandApplication} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {runApifyActor} from '../../server/runApifyActor.server';
import {DemoEmbedType} from '../../utils/enums';

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

  const application = await db.query.bandApplication.findFirst({
    where: eq(bandApplication.id, id),
  });
  if (!application) {
    throw new Error(`BandApplication ${id} not found`);
  }
  const demo = application.demo?.split(' ').shift();
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
        case 'shorts':
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
      const release = await bandcampRelease(url.toString());
      if (release?.type === 'track') {
        demoEmbedType = DemoEmbedType.BandcampTrack;
        demoEmbed = release.id.toString();
      } else if (release?.type === 'album') {
        demoEmbedType = DemoEmbedType.BandcampAlbum;
        demoEmbed = release.id.toString();
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

  await db
    .update(bandApplication)
    .set({demoEmbed, demoEmbedType})
    .where(eq(bandApplication.id, id));

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

const BANDCAMP_ACTOR = 'service-paradis~bandcamp-crawler';

/** One dataset item of `service-paradis/bandcamp-crawler` (the fields we use). */
type BandcampItem =
  | {type: 'track' | 'album'; id: number; url: string}
  | {type: 'artist' | 'label'; releases?: Array<{url: string}>};

/**
 * Resolves a Bandcamp URL to the track or album it should embed. An artist or
 * label page resolves to its first listed release, which is the newest one.
 *
 * Scraping Bandcamp ourselves stopped working: its bot protection answers
 * `bandcamp-scraper`'s HTTP client with a challenge page, which that library
 * then fails to parse inside a callback, so the task hung until Vercel's
 * timeout instead of failing. Apify's crawler fetches through their proxy.
 *
 * One URL per run, without the discography, so the dataset's first item is
 * the page we asked for. Two runs at most, so each gets about half of the
 * function's time budget.
 */
async function bandcampRelease(url: string) {
  const run = async (url: string) =>
    (
      await runApifyActor<BandcampItem>(
        BANDCAMP_ACTOR,
        {startUrls: [{url}], maxItems: 1, includeDiscography: false},
        25,
      )
    ).at(0);

  const item = await run(url);
  if (item?.type === 'artist' || item?.type === 'label') {
    const latest = item.releases?.at(0)?.url;
    return latest ? run(latest) : undefined;
  }
  return item;
}
