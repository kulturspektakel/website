import {
  logMinuteAt,
  logMinuteIndex,
  type DeviceSeries,
  type LevelColumn,
  type ProjectLogs,
  type Weighting,
} from './noise';
import {type LevelMetric} from './level';
import {seriesFor} from './series';
import {energeticMeanDb, type Coverage} from './leq';

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
  metric: LevelMetric,
  weighting: Weighting,
): (number | null)[] | undefined =>
  logs.devices[deviceId]?.[seriesFor(metric, weighting).col as LevelColumn];

// The 1-minute column, the only one an aggregate over a range may average: 5m and 30m
// are trailing windows the device reports, so averaging those would average twice.
const eqColumn = (logs: ProjectLogs, deviceId: string, weighting: Weighting) =>
  logColumn(logs, deviceId, 'eq_fast', weighting);

// A crop's Leq for one device, carrying how much of the crop it was actually
// measured over — which is the caveat that keeps the number honest.
export type RangeTotals = {db: number} & Coverage;

/**
 * The Leq one device measured over a window: the energetic mean of the minutes it
 * actually reported. Nulls are skipped rather than counted as silence, so a monitor
 * that was offline — or that stood somewhere else for part of the window — is
 * averaged over the time it was there, not over the window's whole span. That makes
 * the coverage alongside it part of the answer, not a decoration: without it a
 * monitor present for two minutes of an hour reads exactly like one present all of it.
 */
export function logRangeTotals(
  logs: ProjectLogs,
  deviceId: string,
  range: {start: number; end: number},
  weighting: Weighting,
): RangeTotals | null {
  const values = eqColumn(logs, deviceId, weighting);
  if (!values) return null;
  // Half-open and clamped into the payload, like every other range in this section:
  // the minute containing `end` is not included. Bounds rather than a slice, because
  // copying a crop's worth of numbers per device per frame is the one allocation on
  // this path that would be felt.
  const from = Math.max(0, logMinuteIndex(logs, range.start));
  const to = Math.min(logs.minutes, logMinuteIndex(logs, range.end));
  if (from >= to) return null;
  const db = energeticMeanDb(values, from, to);
  if (db == null) return null;
  // How many of those minutes the mean actually had to work with. A second pass over
  // the same bounds rather than a count out of energeticMeanDb: it is read by the
  // device page too, and this costs no allocation on a path that cares about that.
  //
  // `expectedMinutes` is the crop clamped to the payload, and the payload already
  // ends at the last elapsed minute (see projectLogs on the server) — so a crop
  // reaching into a running festival's future isn't charged for minutes that haven't
  // happened, exactly as expectedMinutes() does for the device page.
  let minutes = 0;
  for (let i = from; i < to; i++) if (values[i] != null) minutes++;
  return {db, minutes, expectedMinutes: to - from};
}

/**
 * What each device read at the playhead, in whatever window the header's two
 * dropdowns are set to — the number the pins carry and the coloured one on each row.
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
  }: {
    metric: LevelMetric;
    weighting: Weighting;
    current: number;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  const minute = logMinuteIndex(logs, current);
  for (const deviceId of Object.keys(logs.devices)) {
    const db = logColumn(logs, deviceId, metric, weighting)?.[minute];
    if (db != null) out[deviceId] = db;
  }
  return out;
}

/**
 * What each device averaged over the whole crop — the number every row leads with,
 * whatever the picker is set to. Its own record, and not a mode of the one above,
 * because the two answer different questions and change on different things: this one
 * ignores the playhead, that one ignores the crop.
 */
export function totalsByDevice(
  logs: ProjectLogs,
  range: {start: number; end: number},
  weighting: Weighting,
): Record<string, RangeTotals> {
  const out: Record<string, RangeTotals> = {};
  for (const deviceId of Object.keys(logs.devices)) {
    const totals = logRangeTotals(logs, deviceId, range, weighting);
    if (totals != null) out[deviceId] = totals;
  }
  return out;
}

/**
 * One trace per device, at full stored resolution over the whole project — what the
 * list draws behind its rows, in whichever window the header is set to.
 *
 * The 5m and 30m lines are read straight out of their own columns rather than rolled
 * up from the 1m one: the device reports those trailing windows itself, so averaging
 * the minutes here would both average twice and disagree with the number printed on
 * the row beside the chart.
 *
 * Deliberately not cropped or downsampled here. uPlot clips to its own x-scale by
 * binary search and reduces to min/max per pixel column, so a crop change costs it a
 * redraw and costs this nothing: the traces depend only on the payload, the window
 * and the weighting, which is what makes dragging the timeline free. It also draws
 * the peaks an averaged bucket would have flattened.
 *
 * The x column is built once and shared by every device — hence `stepMs` in the
 * payload, and hence nulls for the minutes a device has nothing.
 */
export function logSeries(
  logs: ProjectLogs,
  metric: LevelMetric,
  weighting: Weighting,
): Record<string, DeviceSeries> {
  // Epoch seconds, uPlot's x unit.
  const xs = Array.from(
    {length: logs.minutes},
    (_, i) => logMinuteAt(logs, i) / 1000,
  );
  const out: Record<string, DeviceSeries> = {};
  for (const deviceId of Object.keys(logs.devices)) {
    const db = logColumn(logs, deviceId, metric, weighting);
    if (db) out[deviceId] = {xs, db};
  }
  return out;
}
