import https from 'node:https';
import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';

export type InstagramFollowerPayload = {id: string; cookie?: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/instagramFollower.ts`.
 * Reads the follower count from Instagram's web_profile_info endpoint and
 * stores it on the BandApplication. Throws on unexpected responses so Cloud
 * Tasks retries; a 404 (unknown handle) is treated as a no-op.
 */
export async function handleInstagramFollower(
  request: Request,
): Promise<Response> {
  const {id, cookie = ''} =
    await readJsonPayload<InstagramFollowerPayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  if (!application?.instagram) {
    return new Response(null, {status: 204});
  }

  const res = await instagramGet(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${application.instagram}`,
    {'X-IG-App-ID': '936619743392459', cookie},
  );

  if (res.status === 200) {
    const json: {
      data?: {user?: {edge_followed_by?: {count?: number}}};
    } = JSON.parse(res.body);

    const count = json?.data?.user?.edge_followed_by?.count;
    if (count != null) {
      await prismaClient.bandApplication.update({
        where: {id},
        data: {instagramFollower: count},
      });
      return new Response(null, {status: 204});
    }
    throw new Error(res.body);
  } else if (res.status === 404) {
    console.error(`Instagram user ${application.instagram} not found`);
    return new Response(null, {status: 204});
  } else {
    throw new Error(res.body);
  }
}

/**
 * Plain GET via `node:https` rather than `fetch`.
 *
 * Instagram's edge rejects anything carrying browser fetch-metadata headers
 * with `400 SecFetch Policy violation.`, and Node's built-in `fetch` (undici)
 * unconditionally appends `Sec-Fetch-Mode: cors` and
 * `Sec-Fetch-Site: cross-site`. Those are forbidden header names, so they
 * cannot be overridden or removed from the `fetch` side — `node:https` sends
 * only the headers we hand it, which Instagram accepts.
 */
function instagramGet(
  url: string,
  headers: Record<string, string>,
): Promise<{status: number; body: string}> {
  return new Promise((resolve, reject) => {
    https
      .get(url, {headers}, (res) => {
        res.setEncoding('utf8');
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({status: res.statusCode ?? 0, body}));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}
