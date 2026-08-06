import {prismaClient} from './prismaClient.server';
import {
  HISTORY_SERIES,
  decodeDb,
  type DeviceLocationRecord,
  type HistoryRow,
} from '../components/lautstaerke/context';
import {MINUTE_MS, floorToMinute} from '../components/lautstaerke/timeframe';
import {
  energeticMeanDb,
  expectedMinutes,
  type HistoryTotals,
} from '../components/lautstaerke/leq';
import {
  MAX_RANGE_DAYS,
  MAX_RANGE_MS,
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

// Project the aggregate rows into the [x, ...columns] layout uPlot wants, with
// one column per HISTORY_SERIES entry in order. The SQL only emits minutes that
// had data, so gaps are rendered by NoiseTimeChart's gap refiner (a > threshold
// jump between consecutive x values), no explicit null rows needed. Individual
// nulls (a missing 5m/30m value on an otherwise-present minute) break just that
// line. The view casts the result to uPlot.AlignedData at the chart edge.
export function rowsToAligned(rows: HistoryRow[]): (number | null)[][] {
  const xs = rows.map((r) => r.minute_epoch);
  const cols = HISTORY_SERIES.map((s) => rows.map((r) => r[s.col]));
  return [xs, ...cols];
}

// The single Leq for the selected timeframe, both weightings so the A/C toggle
// needs no refetch. Read off the named HistoryRow fields rather than the aligned
// columns, so a HISTORY_SERIES reorder can't silently change which level this
// averages. Rows are already one-per-minute and equally weighted, so this is a
// plain energetic mean — see energeticMeanDb for why it isn't an arithmetic one.
//
// A gap is an *absent row*, not a null: NoiseLog.laeq/lceq are NOT NULL, so unlike
// the 5m/30m columns these two are always present on a row that exists. The mean is
// therefore over the minutes that were measured (standard Leq-over-measured-time) —
// treating a gap as silence would drag the level down and misrepresent it, so the
// caller gets `minutes`/`expectedMinutes` to disclose how much was actually covered.
export function historyTotals(
  rows: HistoryRow[],
  start: Date,
  end: Date,
  now = Date.now(),
): HistoryTotals {
  return {
    laeq: energeticMeanDb(rows.map((r) => r.laeq_1m)),
    lceq: energeticMeanDb(rows.map((r) => r.lceq_1m)),
    minutes: rows.length,
    expectedMinutes: expectedMinutes(start, end, now),
  };
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
): Promise<Record<string, number>> {
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

  const levels: Record<string, number> = {};
  for (const log of logs) {
    levels[log.deviceId] ??= decodeDb(log.laeq);
  }
  return levels;
}
