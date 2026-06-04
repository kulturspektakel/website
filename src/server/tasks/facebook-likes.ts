import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';

export type FacebookLikesPayload = {id: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/facebookLikes.ts`.
 * Resolves the page id from the applicant's Facebook URL and stores its
 * follower count on the BandApplication. Private profiles are a no-op.
 */
export async function handleFacebookLikes(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<FacebookLikesPayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  if (!application?.facebook) {
    return new Response(null, {status: 204});
  }

  const fbid = await extractFbid(application.facebook);
  if (!fbid) {
    return new Response(null, {status: 204});
  }

  const res = await fetch(
    `https://graph.facebook.com/v24.0/${fbid}?fields=followers_count&access_token=${process.env.FACEBOOK_ACCESS_TOKEN}`,
  );

  const data:
    | {followers_count?: number}
    | {
        error: {
          message: string;
          type: string;
          code: number;
          error_subcode: number;
        };
      } = await res.json().catch(() => null);

  if (!data) {
    const text = await res.text();
    throw new Error(`Facebook API error: ${text}`);
  }

  if (res.ok && 'followers_count' in data) {
    await prismaClient.bandApplication.update({
      where: {id},
      data: {facebookLikes: data.followers_count},
    });
  } else if (
    'error' in data &&
    data.error.code === 100 &&
    data.error.error_subcode === 33
  ) {
    // Private profile — nothing to store.
    return new Response(null, {status: 204});
  } else {
    throw new Error(`Facebook API error: ${JSON.stringify(data)}`);
  }

  return new Response(null, {status: 204});
}

export async function extractFbid(
  uri: string,
  followRedirects = true,
): Promise<string | null | undefined> {
  const url = new URL(uri);

  if (
    !url.hostname.endsWith('facebook.com') &&
    !url.hostname.endsWith('fb.com') &&
    !url.hostname.endsWith('facebook.de') &&
    !url.hostname.endsWith('fb.me')
  ) {
    return;
  }

  const path = url.pathname.split('/');
  if (url.pathname === '/profile.php') {
    return url.searchParams.get('id');
  }

  if ((path[1] === 'pages' || path[1] === 'people') && path.length > 3) {
    return path[3];
  }
  if (path[1] === 'share' && followRedirects) {
    const res = await fetch(uri, {method: 'HEAD', redirect: 'follow'});
    return await extractFbid(res.url, false);
  }

  let slug = path[1];
  if (path[1] === 'p' && path.length > 2) {
    slug = path[2];
  }

  const match = slug.match(/[a-z-]+-(\d{7}\d+)$/i);
  if (match != null && match.length > 1) {
    return match[1];
  }

  return path[1];
}
