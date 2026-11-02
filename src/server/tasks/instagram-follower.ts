import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {bandApplication} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {runApifyActor} from '../../server/runApifyActor.server';
import {isInstagramHandle} from '../../utils/instagramHandle';

export type InstagramFollowerPayload = {id: string};

const ACTOR = 'apify~instagram-profile-scraper';

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
 * Unexpected responses throw so Cloud Tasks retries; a handle the actor
 * can't read (error item) is treated as a no-op.
 */
export async function handleInstagramFollower(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<InstagramFollowerPayload>(request);

  const application = await db.query.bandApplication.findFirst({
    where: eq(bandApplication.id, id),
  });
  const handle = application?.instagram;
  if (!handle) {
    return new Response(null, {status: 204});
  }
  // Older rows predate the form's handle normalisation and may hold anything.
  // A junk value can't resolve to a profile, and the actor bills per result,
  // so don't pay to find that out.
  if (!isInstagramHandle(handle)) {
    console.error(`Instagram handle ${JSON.stringify(handle)} is not a handle`);
    return new Response(null, {status: 204});
  }

  const items = await runApifyActor<ProfileItem>(
    ACTOR,
    {usernames: [handle]},
    45,
  );
  const item = items.at(0);

  // The actor answers a handle it can't read (unknown, private, or not a
  // profile) with an error item. That won't change on retry, and every retry
  // is another billed run, so give up rather than burn the queue's attempts.
  if (item?.error) {
    console.error(
      `No Instagram profile for ${handle}: ${item.error} (${item.errorDescription})`,
    );
    return new Response(null, {status: 204});
  }

  const count = item?.followersCount;
  if (count == null) {
    throw new Error(
      `No follower count for ${handle}: ${JSON.stringify(items)}`,
    );
  }

  await db
    .update(bandApplication)
    .set({instagramFollower: count})
    .where(eq(bandApplication.id, id));

  return new Response(null, {status: 204});
}
