import {
  logMinuteAt,
  logMinuteIndex,
  type DeviceSeries,
  type LevelColumn,
  type ProjectLogs,
  type Weighting,
} from './noise';
import {isPointMetric, type LevelMetric, type PointMetric} from './level';
import {seriesFor} from './series';
import {energeticMeanDb} from './leq';

// Reading the project page's numbers off the whole event, which the browser now
// holds (see projectLogs in noiseHistory.server.ts). Every question the map and the
// list ask is an index or a slice into a minute-indexed column, so scrubbing,
// cropping and both header dropdowns cost no request at all.
//
// React-free on purpose: this is where the maths lives, the hook beside it
// (useProjectLogs.ts) only decides when to recompute.

// The column one window occupies under one weighting, resolved through the series
// table so the mapping lives in the one place that already owns it. Undefined when
// the device has no entry, or when that column was null throughout and so was left
// out of the payload.
export const logColumn = (
  logs: ProjectLogs,
  deviceId: string,
  metric: PointMetric,
  weighting: Weighting,
): (number | null)[] | undefined =>
  logs.devices[deviceId]?.[seriesFor(metric, weighting).col as LevelColumn];

// The 1-minute column, the only one an aggregate over a range may average: 5m and 30m
// are trailing windows the device reports, so averaging those would average twice.
const eqColumn = (logs: ProjectLogs, deviceId: string, weighting: Weighting) =>
  logColumn(logs, deviceId, 'eq_fast', weighting);

/**
 * The Leq one device measured over a window: the energetic mean of the minutes it
 * actually reported. Nulls are skipped rather than counted as silence, so a monitor
 * that was offline — or that stood somewhere else for part of the window — is
 * averaged over the time it was there, not over the window's whole span.
 */
export function logRangeLeq(
  logs: ProjectLogs,
  deviceId: string,
  range: {start: number; end: number},
  weighting: Weighting,
): number | null {
  const values = eqColumn(logs, deviceId, weighting);
  if (!values) return null;
  // Half-open and clamped into the payload, like every other range in this section:
  // the minute containing `end` is not included. Bounds rather than a slice, because
  // copying a crop's worth of numbers per device per frame is the one allocation on
  // this path that would be felt.
  const from = Math.max(0, logMinuteIndex(logs, range.start));
  const to = Math.min(logs.minutes, logMinuteIndex(logs, range.end));
  return from >= to ? null : energeticMeanDb(values, from, to);
}

/**
 * The one number per device the pins and the rows show, for whatever the header's
 * two dropdowns are set to — the instantaneous windows read the playhead's minute,
 * the range Leq averages the crop.
 *
 * Devices with no value are left out rather than carried as null: absent and
 * unmeasured render identically, and every consumer keys on presence. Same shape the
 * three deleted queries used to hand over, which is what keeps this out of the leaf
 * components.
 */
export function levelsByDevice(
  logs: ProjectLogs,
  {
    metric,
    weighting,
    current,
    range,
  }: {
    metric: LevelMetric;
    weighting: Weighting;
    current: number;
    range: {start: number; end: number};
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  const minute = logMinuteIndex(logs, current);
  for (const deviceId of Object.keys(logs.devices)) {
    const db = isPointMetric(metric)
      ? (logColumn(logs, deviceId, metric, weighting)?.[minute] ?? null)
      : logRangeLeq(logs, deviceId, range, weighting);
    if (db != null) out[deviceId] = db;
  }
  return out;
}

/**
 * One trace per device, at full stored resolution over the whole project — what the
 * list draws behind its rows.
 *
 * Deliberately not cropped or downsampled here. uPlot clips to its own x-scale by
 * binary search and reduces to min/max per pixel column, so a crop change costs it a
 * redraw and costs this nothing: the traces depend only on the payload and the
 * weighting, which is what makes dragging the timeline free. It also draws the peaks
 * an averaged bucket would have flattened.
 *
 * The x column is built once and shared by every device — hence `stepMs` in the
 * payload, and hence nulls for the minutes a device has nothing.
 */
export function logSeries(
  logs: ProjectLogs,
  weighting: Weighting,
): Record<string, DeviceSeries> {
  // Epoch seconds, uPlot's x unit.
  const xs = Array.from(
    {length: logs.minutes},
    (_, i) => logMinuteAt(logs, i) / 1000,
  );
  const out: Record<string, DeviceSeries> = {};
  for (const deviceId of Object.keys(logs.devices)) {
    const db = eqColumn(logs, deviceId, weighting);
    if (db) out[deviceId] = {xs, db};
  }
  return out;
}
