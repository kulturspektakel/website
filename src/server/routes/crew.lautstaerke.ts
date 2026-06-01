import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const deviceLocations = createServerFn().handler(async () => {
  const rows = await prismaClient.deviceLocation.findMany({
    where: {Device: {type: 'NOISE_MONITOR'}},
    orderBy: {createdAt: 'desc'},
    distinct: ['deviceId'],
    select: {deviceId: true, locationName: true},
  });
  return Object.fromEntries(rows.map((r) => [r.deviceId, r.locationName]));
});
