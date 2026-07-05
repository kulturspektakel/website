import {subMinutes} from 'date-fns';
import {tzOffset} from '@date-fns/tz';
import {prismaClient} from './prismaClient.server';
import {
  HISTORY_SERIES,
  type DeviceLocationRecord,
  type HistoryRow,
} from '../components/lautstaerke/context';
import {timeZone} from '../utils/dateUtils';

// NoiseLog.measuredAt is stored as a UTC instant. A local day runs from local
// 00:00 to the next local 00:00; convert each boundary with that date's timeZone
// offset so the range stays correct across DST transitions.
export function localDayRange(date: string): {start: Date; end: Date} {
  const [y, m, d] = date.split('-').map(Number);
  const startUtc = new Date(Date.UTC(y, m - 1, d));
  const endUtc = new Date(Date.UTC(y, m - 1, d + 1));
  return {
    start: subMinutes(startUtc, tzOffset(timeZone, startUtc)),
    end: subMinutes(endUtc, tzOffset(timeZone, endUtc)),
  };
}

// NoiseLog already holds one 60-second aggregate per row (measuredAt = the start
// of that minute), and every level — the 1m Leq, the device's trailing 5m/30m
// windows, and the max/peak values — is stored per row. So this is a straight
// per-row decode for one device and one local day: no aggregation, since each
// row is already the minute. Stored ints are encoded as (dB - 20) * 2, so
// dB = 20 + val/2; the 5m/30m columns are null until the device's buffer has
// filled (and for rows ingested before those columns existed), which decodes to
// null and simply leaves a gap in that line.
//
// The WHERE clause is a single range scan on the @@unique([deviceId, measuredAt])
// index (~1440 rows/day), so this stays cheap.
export async function noiseHistory(
  deviceId: string,
  date: string,
): Promise<HistoryRow[]> {
  const {start, end} = localDayRange(date);
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

// The up-to-10 most recent local-timezone days that have any data for a device,
// as 'yyyy-mm-dd' strings (newest first), for the day picker. "Has data" is
// evaluated in `timeZone`: measuredAt is stored as a UTC instant, so we
// reinterpret it as UTC then shift to `timeZone` before truncating to a day.
export async function noiseDays(deviceId: string): Promise<string[]> {
  const rows = await prismaClient.$queryRaw<{date: string}[]>`
    SELECT to_char(day, 'YYYY-MM-DD') AS date
    FROM (
      SELECT DISTINCT
        date_trunc('day', ("measuredAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}) AS day
      FROM "NoiseLog"
      WHERE "deviceId" = ${deviceId}
    ) d
    ORDER BY day DESC
    LIMIT 10
  `;
  return rows.map((r) => r.date);
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
