import {
  logMinuteAt,
  logMinuteIndex,
  type DeviceSeries,
  type LevelColumn,
  type LogGrid,
  type ProjectLogs,
  type Weighting,
} from './noise';
import {type LevelMetric} from './level';
import {seriesFor} from './series';
import {fromEnergy, toEnergy, usableDb, type Coverage} from './leq';

// Reading the project page's numbers off the whole event, which the browser now
// holds (see projectLogs in noiseHistory.server.ts). Every question the map and the
// list ask is an index into a minute-indexed column, a slice of one, or — for the Leq
// over a crop, the one question a slice would be too slow to answer as the timeline is
// dragged — a difference of two running totals. None of them costs a request.
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
 * The project's per-minute Leq columns as running totals: for every device, the
 * cumulative acoustic energy up to each minute and the cumulative count of minutes it
 * actually reported.
 *
 * Built once per payload and weighting, because of what asks for a Leq: dragging the
 * timeline re-averages the crop for every device on every animation frame, and over a
 * four-day event that was tens of thousands of 10^(v/10) per frame — for a number the
 * drag moves by a minute at a time. Off a running total, any crop is two subtractions.
 *
 * Typed arrays because they are one entry per minute per device, hold nothing but
 * numbers, and exist to be read hot. One entry longer than the payload, so index i is
 * "everything before minute i" and the empty range needs no special case.
 */
// The grid and the count rather than the whole payload: once the columns are summed
// nothing re-walks them, and saying so in the type is what keeps that true. Carrying
// the grid at all — rather than taking it beside the index at every call — is what
// makes it impossible to read a range out of an index built for another project.
export type EnergyIndex = {
  grid: LogGrid;
  minutes: number;
  devices: Record<string, {energy: Float64Array; measured: Int32Array}>;
};

export function energyIndex(
  logs: ProjectLogs,
  weighting: Weighting,
): EnergyIndex {
  const devices: EnergyIndex['devices'] = {};
  for (const deviceId of Object.keys(logs.devices)) {
    const values = eqColumn(logs, deviceId, weighting);
    if (!values) continue;
    const energy = new Float64Array(logs.minutes + 1);
    const measured = new Int32Array(logs.minutes + 1);
    for (let i = 0; i < logs.minutes; i++) {
      const v = values[i];
      const usable = usableDb(v);
      energy[i + 1] = energy[i]! + (usable ? toEnergy(v) : 0);
      measured[i + 1] = measured[i]! + (usable ? 1 : 0);
    }
    devices[deviceId] = {energy, measured};
  }
  return {grid: logs, minutes: logs.minutes, devices};
}

/**
 * The Leq one device measured over a window: the energetic mean of the minutes it
 * actually reported. Nulls are skipped rather than counted as silence, so a monitor
 * that was offline — or that stood somewhere else for part of the window — is
 * averaged over the time it was there, not over the window's whole span. That makes
 * the coverage alongside it part of the answer, not a decoration: without it a
 * monitor present for two minutes of an hour reads exactly like one present all of it.
 *
 * The mean is the one energeticMeanDb defines; it is read off the index rather than
 * computed here so that a crop costs the same whether it spans a minute or a festival.
 */
export function rangeTotals(
  index: EnergyIndex,
  deviceId: string,
  range: {start: number; end: number},
): RangeTotals | null {
  const device = index.devices[deviceId];
  if (!device) return null;
  // Half-open and clamped into the payload, like every other range in this section:
  // the minute containing `end` is not included.
  const from = Math.max(0, logMinuteIndex(index.grid, range.start));
  const to = Math.min(index.minutes, logMinuteIndex(index.grid, range.end));
  if (from >= to) return null;
  // How many of those minutes the mean actually had to work with, which is also what
  // says whether there is a mean at all.
  const minutes = device.measured[to]! - device.measured[from]!;
  if (minutes === 0) return null;
  const db = fromEnergy((device.energy[to]! - device.energy[from]!) / minutes);
  // `expectedMinutes` is the crop clamped to the payload, and the payload already
  // ends at the last elapsed minute (see projectLogs on the server) — so a crop
  // reaching into a running festival's future isn't charged for minutes that haven't
  // happened, exactly as expectedMinutes() does for the device page.
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
    // The playhead's minute, not its instant: the payload has no finer resolution, so
    // the caller resolves it once and can then hold this answer still for every frame
    // of a hover that stays inside the same minute (see useProjectLogs).
    minute,
  }: {
    metric: LevelMetric;
    weighting: Weighting;
    minute: number;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
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
  index: EnergyIndex,
  range: {start: number; end: number},
): Record<string, RangeTotals> {
  const out: Record<string, RangeTotals> = {};
  for (const deviceId of Object.keys(index.devices)) {
    const totals = rangeTotals(index, deviceId, range);
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
