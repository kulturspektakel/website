import {prismaClient} from '../../utils/prismaClient.server';
import {readJsonPayload} from '../../utils/readJsonPayload.server';
import {getDistanceToKult, getPlace} from '../../utils/distanceToKult.server';

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

  const application = await prismaClient.bandApplication.findUniqueOrThrow({
    where: {id},
  });

  const data = await getPlace(application.city);
  if (data) {
    const distance = await getDistanceToKult(data.placeId);
    await prismaClient.bandApplication.update({
      where: {id},
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        distance,
      },
    });
  }

  return new Response(null, {status: 204});
}
