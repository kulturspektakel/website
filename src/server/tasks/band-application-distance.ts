import {eq} from 'drizzle-orm';
import {db} from '../../server/db.server';
import {bandApplication} from '../../server/db/schema';
import {readJsonPayload} from '../../server/readJsonPayload.server';
import {getDistanceToKult, getPlace} from '../../server/distanceToKult.server';

export type BandApplicationDistancePayload = {id: string};

/**
 * Migrated from `~/api.kulturspektakel.de/src/tasks/bandApplicationDistance.ts`.
 * Geocodes the applicant's city and stores lat/lng + driving distance to the
 * festival site on the BandApplication row.
 */
export async function handleBandApplicationDistance(
  request: Request,
): Promise<Response> {
  const {id} = await readJsonPayload<BandApplicationDistancePayload>(request);

  const application = await db.query.bandApplication.findFirst({
    where: eq(bandApplication.id, id),
  });
  if (!application) {
    throw new Error(`BandApplication ${id} not found`);
  }

  const data = await getPlace(application.city);
  if (data) {
    const distance = await getDistanceToKult(data.placeId);
    await db
      .update(bandApplication)
      .set({latitude: data.latitude, longitude: data.longitude, distance})
      .where(eq(bandApplication.id, id));
  }

  return new Response(null, {status: 204});
}
