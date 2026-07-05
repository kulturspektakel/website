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
// of that minute). This projects those rows into the per-minute series for one
// device and one local day, entirely in SQL. Stored ints are encoded as
// (dB - 20) * 2, so dB = 20 + val/2 and energy = 10^(dB/10).
//
//  - Leq,1m: the row's own Leq, decoded to dB (one row per minute group).
//  - Leq,5m / Leq,30m: energy mean over a time-RANGE window of minutes, so
//    missing minutes simply contribute nothing (gap-tolerant) rather than
//    skewing the span.
//  - max/peak: per-minute MAX, decoded to dB.
//
// The WHERE clause is a single range scan on the @@unique([deviceId, measuredAt])
// index (~1440 rows/day → 1440 minute groups), so this stays cheap.
export async function noiseHistory(
  deviceId: string,
  date: string,
): Promise<HistoryRow[]> {
  const {start, end} = localDayRange(date);
  return prismaClient.$queryRaw<HistoryRow[]>`
    WITH per_min AS (
      SELECT
        date_trunc('minute', "measuredAt") AS minute,
        sum(power(10, (20 + laeq / 2.0) / 10))::float8 AS a_energy,
        sum(power(10, (20 + lceq / 2.0) / 10))::float8 AS c_energy,
        count(*)::float8 AS n,
        max(lafmax) AS a_fmax,
        max(lcfmax) AS c_fmax,
        max(lcpeak) AS c_peak
      FROM "NoiseLog"
      WHERE "deviceId" = ${deviceId}
        AND "measuredAt" >= ${start}
        AND "measuredAt" < ${end}
      GROUP BY 1
    ), windowed AS (
      SELECT
        minute,
        10 * log(a_energy / n) AS laeq_1m,
        10 * log(c_energy / n) AS lceq_1m,
        10 * log(sum(a_energy) OVER w5 / NULLIF(sum(n) OVER w5, 0)) AS laeq_5m,
        10 * log(sum(c_energy) OVER w5 / NULLIF(sum(n) OVER w5, 0)) AS lceq_5m,
        10 * log(sum(a_energy) OVER w30 / NULLIF(sum(n) OVER w30, 0)) AS laeq_30m,
        10 * log(sum(c_energy) OVER w30 / NULLIF(sum(n) OVER w30, 0)) AS lceq_30m,
        20 + a_fmax / 2.0 AS lafmax,
        20 + c_fmax / 2.0 AS lcfmax,
        20 + c_peak / 2.0 AS lcpeak
      FROM per_min
      WINDOW
        w5 AS (ORDER BY minute RANGE BETWEEN INTERVAL '4 minutes' PRECEDING AND CURRENT ROW),
        w30 AS (ORDER BY minute RANGE BETWEEN INTERVAL '29 minutes' PRECEDING AND CURRENT ROW)
    )
    SELECT
      extract(epoch FROM minute)::float8 AS minute_epoch,
      laeq_1m::float8, laeq_5m::float8, laeq_30m::float8, lafmax::float8,
      lceq_1m::float8, lceq_5m::float8, lceq_30m::float8,
      lcfmax::float8, lcpeak::float8
    FROM windowed
    ORDER BY minute
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
// jump between consecutive x values), no explicit null rows needed. Returned as
// plain number[][]; the view casts it to uPlot.AlignedData at the chart edge.
export function rowsToAligned(rows: HistoryRow[]): number[][] {
  const xs = rows.map((r) => r.minute_epoch);
  const cols = HISTORY_SERIES.map((s) => rows.map((r) => r[s.col]));
  return [xs, ...cols];
}
