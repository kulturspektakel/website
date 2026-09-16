import {prismaClient} from '../../server/prismaClient.server';
import {readJsonPayload} from '../../server/readJsonPayload.server';

export type InstagramFollowerPayload = {id: string};

const ACTOR = 'apify~instagram-profile-scraper';

/** Instagram handles are `[A-Za-z0-9._]`, max 30 chars. */
const HANDLE = /^[A-Za-z0-9._]{1,30}$/;

/** One dataset item of `apify/instagram-profile-scraper` (the fields we use). */
type ProfileItem = {
  username?: string;
  followersCount?: number | null;
  error?: string;
  errorDescription?: string;
};

/**
 * Stores the applicant's Instagram follower count on the BandApplication.
 *
 * Scraping Instagram from our own IPs no longer works. Two attempts failed
 * before this one: `api/v1/users/web_profile_info` is login-gated (`401
 * {"require_login": true}`), and parsing `og:description` off the public
 * profile page — which works from a normal IP with a crawler User-Agent —
 * gets a 302 from the Vercel deployment. So hand the handle to Apify's
 * Instagram Profile Scraper and read `followersCount` off the dataset item.
 *
 * As a bonus this is exact: `og:description` abbreviates above 10,000
 * (`17K`, `2M`), so that route could only ever store two or three
 * significant figures for the accounts where the number matters most.
 *
 * Unexpected responses throw so Cloud Tasks retries; a handle Instagram
 * doesn't know is treated as a no-op.
 */
export async function handleInstagramFollower(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<InstagramFollowerPayload>(request);

  const application = await prismaClient.bandApplication.findUnique({
    where: {id},
  });
  const handle = application?.instagram;
  if (!handle) {
    return new Response(null, {status: 204});
  }
  // Older rows predate the form's handle normalisation and may hold anything.
  // A junk value can't resolve to a profile, and the actor bills per result,
  // so don't pay to find that out.
  if (!HANDLE.test(handle)) {
    console.error(`Instagram handle ${JSON.stringify(handle)} is not a handle`);
    return new Response(null, {status: 204});
  }

  const items = await runActor(handle);
  const item = items.at(0);

  if (item?.error === 'not_found') {
    console.error(`Instagram user ${handle} not found`);
    return new Response(null, {status: 204});
  }

  const count = item?.followersCount;
  if (count == null) {
    throw new Error(
      `No follower count for ${handle}: ${JSON.stringify(items)}`,
    );
  }

  await prismaClient.bandApplication.update({
    where: {id},
    data: {instagramFollower: count},
  });

  return new Response(null, {status: 204});
}

/**
 * Runs the actor synchronously and returns its dataset items.
 *
 * `run-sync-get-dataset-items` blocks until the run finishes, which for a
 * single profile is a handful of seconds. The `timeout` bounds that wait well
 * inside the function's own limit: if Apify is slow or wedged we'd rather fail
 * and let the scrapers queue retry later than sit on an open request.
 */
export async function runActor(username: string): Promise<ProfileItem[]> {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=120`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.APIFY_TOKEN}`,
      },
      body: JSON.stringify({usernames: [username]}),
    },
  );

  if (!res.ok) {
    throw new Error(`Apify HTTP${res.status}: ${await res.text()}`);
  }

  return (await res.json()) as ProfileItem[];
}
