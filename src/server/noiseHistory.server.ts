import {prismaClient} from './prismaClient.server';
import {
  decodeDb,
  type DeviceLocationRecord,
  type HistoryRow,
  type NoiseLevels,
} from '../components/lautstaerke/noise';
import {
  MAX_RANGE_DAYS,
  MAX_RANGE_MS,
  MINUTE_MS,
  floorToMinute,
} from '../components/lautstaerke/timeframe';

// NoiseLog already holds one 60-second aggregate per row (measuredAt = the start
// of that minute), and every level — the 1m Leq, the device's trailing 5m/30m
// windows, and the max/peak values — is stored per row. So this is a straight
// per-row decode for one device over the requested UTC range: no aggregation and
// deliberately no downsampling, since each row is already the minute. Stored ints
// are encoded as (dB - 20) * 2, so dB = 20 + val/2; the 5m/30m columns are null
// until the device's buffer has filled (and for rows ingested before those
// columns existed), which decodes to null and simply leaves a gap in that line.
//
// The WHERE clause is a single range scan on the @@unique([deviceId, measuredAt])
// index (~1440 rows/day), so this stays cheap for the ranges MAX_RANGE_MS allows.
export async function noiseHistory(
  deviceId: string,
  start: Date,
  end: Date,
): Promise<HistoryRow[]> {
  // Backstop only: parseRangeSearch already rejects over-cap ranges at every
  // entry point, so reaching this means a caller bypassed it.
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new Error(`noiseHistory: range exceeds ${MAX_RANGE_DAYS} days`);
  }
  return prismaClient.$queryRaw<HistoryRow[]>`
    SELECT
      extract(epoch FROM "measuredAt")::float8 AS minute_epoch,
      (20 + laeq / 2.0)::float8 AS laeq_1m,
      (20 + lceq / 2.0)::float8 AS lceq_1m,
      (20 + laeq5m / 2.0)::float8 AS laeq_5m,
      (20 + lceq5m / 2.0)::float8 AS lceq_5m,
      (20 + laeq30m / 2.0)::float8 AS laeq_30m,
      (20 + lceq30m / 2.0)::float8 AS lceq_30m,
      (20 + lafmax / 2.0)::float8 AS lafmax,
      (20 + lcfmax / 2.0)::float8 AS lcfmax,
      (20 + lcpeak / 2.0)::float8 AS lcpeak
    FROM "NoiseLog"
    WHERE "deviceId" = ${deviceId}
      AND "measuredAt" >= ${start}
      AND "measuredAt" < ${end}
    ORDER BY "measuredAt"
  `;
}

// A device's full location history (few rows), oldest first. The label shown for
// a given day is resolved client-side from this (see resolveLocation) since a
// device can be relocated over time.
export async function deviceLocations(
  deviceId: string,
): Promise<DeviceLocationRecord[]> {
  const rows = await prismaClient.deviceLocation.findMany({
    where: {deviceId},
    orderBy: {createdAt: 'asc'},
    select: {locationName: true, createdAt: true},
  });
  return rows.map((r) => ({name: r.locationName, createdAt: r.createdAt.getTime()}));
}

// The stored level for each monitor of one project at a single instant — what the
// project page's list and map show when live mode is off.
//
// Reads the minute the instant falls in, because NoiseLog is one row per
// device-minute. Devices are those assigned *at that instant*, not those assigned
// now, so scrubbing back through a project reads the monitor that actually stood at
// each location then.
export async function projectLevelsAt(
  projectId: string,
  at: Date,
): Promise<NoiseLevels> {
  const minute = new Date(floorToMinute(at.getTime()));
  const nextMinute = new Date(minute.getTime() + MINUTE_MS);

  const assignments = await prismaClient.noiseLocationAssignment.findMany({
    where: {
      NoiseLocation: {projectId},
      start: {lte: at},
      OR: [{end: null}, {end: {gt: at}}],
    },
    select: {deviceId: true},
  });
  const deviceIds = [...new Set(assignments.map((a) => a.deviceId))];
  if (deviceIds.length === 0) return {};

  // A range rather than an equality match: measuredAt comes off the device's own
  // clock, so it marks the start of its 60s window without necessarily landing
  // exactly on the minute. @@unique([deviceId, measuredAt]) makes this an index
  // scan yielding at most one row per device.
  const logs = await prismaClient.noiseLog.findMany({
    where: {deviceId: {in: deviceIds}, measuredAt: {gte: minute, lt: nextMinute}},
    orderBy: {measuredAt: 'asc'},
    select: {deviceId: true, laeq: true},
  });

  const levels: NoiseLevels = {};
  for (const log of logs) {
    levels[log.deviceId] ??= decodeDb(log.laeq);
  }
  return levels;
}
