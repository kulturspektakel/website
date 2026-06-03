import {prismaClient} from '../../utils/prismaClient.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';

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

  const res = await fetch(
    `https://i.instagram.com/api/v1/users/web_profile_info/?username=${application.instagram}`,
    {headers: {'X-IG-App-ID': '936619743392459', cookie}},
  );

  if (res.ok) {
    const json: {
      data?: {user?: {edge_followed_by?: {count?: number}}};
    } = await res.json();

    const count = json?.data?.user?.edge_followed_by?.count;
    if (count != null) {
      await prismaClient.bandApplication.update({
        where: {id},
        data: {instagramFollower: count},
      });
      return new Response(null, {status: 204});
    }
    throw new Error(JSON.stringify(json));
  } else if (res.status === 404) {
    console.error(`Instagram user ${application.instagram} not found`);
    return new Response(null, {status: 204});
  } else {
    throw new Error(await res.text());
  }
}
