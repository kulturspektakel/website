import {
  logMinuteAt,
  logMinuteIndex,
  type DeviceSeries,
  type LevelColumn,
  type LogGrid,
  type ProjectLogs,
  type Weighting,
} from './noise';
import {seriesByKey, seriesKey, SERIES_KEYS, type SeriesKey} from './series';
import {fromEnergy, toEnergy, usableDb, type Coverage} from './leq';
import {exceedsLimit, type LimitLine} from './limitLines';
import {rangeKey} from './level';

// Reading the project page's numbers off the whole event, which the browser now
// holds (see projectLogs in noiseHistory.server.ts). Every question the map and the
// list ask is an index into a minute-indexed column, a slice of one, or — for the Leq
// over a crop, the one question a slice would be too slow to answer as the timeline is
// dragged — a difference of two running totals. None of them costs a request.
//
// React-free on purpose: this is where the maths lives, the hook beside it
// (useProjectLogs.ts) only decides when to recompute.

// The column one series occupies, resolved through the series table so the mapping
// lives in the one place that already owns it. Undefined when the device has no entry,
// or when that column was null throughout and so was left out of the payload.
export const logColumn = (
  logs: ProjectLogs,
  deviceId: string,
  key: SeriesKey,
): (number | null)[] | undefined =>
  logs.devices[deviceId]?.[seriesByKey(key).col as LevelColumn];

// The 1-minute column, the only one an aggregate over a range may average: 5m and 30m
// are trailing windows the device reports, so averaging those would average twice. In
// the weighting the caller asked for — one mean cannot be in two, so the crop's Leq builds
// an index per picked weighting (see RangePick).
const eqColumn = (logs: ProjectLogs, deviceId: string, weighting: Weighting) =>
  logColumn(logs, deviceId, seriesKey('eq_fast', weighting));

// A crop's Leq for one device, carrying how much of the crop it was actually
// measured over — which is the caveat that keeps the number honest.
export type RangeTotals = {db: number} & Coverage;

// Per picked weighting, per location — the shape both of the crop's readings arrive in, its
// Leq and its running line.
export type RangeByWeighting<T> = Partial<Record<Weighting, Record<string, T>>>;

// A location and the placements whose readings count as its own — the same windows the
// chart's lines are clipped to (see maskToWindows), in the shape the index needs.
export type LocationAssignments = {
  id: string;
  assignments: readonly {
    deviceId: string;
    start: number;
    end: number | null;
  }[];
  // Stretches crew tagged to be ignored here (see rangeTags): a null `deviceId` sets aside
  // every monitor standing here, otherwise only that one. Those minutes neither count
  // towards the Leq nor towards the coverage it is measured against — they were set aside
  // on purpose, which is not a monitor missing.
  ignored?: readonly {deviceId: string | null; start: number; end: number}[];
};

// One monitor's ignored stretches at a location, as half-open minute-index ranges on the
// payload's grid — the tags on the whole place and the ones on that monitor alone. Every
// reader of a location's minutes (its Leq, the timeline's coverage and its breaches) skips
// these the same way.
export function ignoredMinutes(
  grid: LogGrid,
  location: Pick<LocationAssignments, 'ignored'>,
  deviceId: string,
): [number, number][] {
  return (location.ignored ?? []).flatMap((t) =>
    t.deviceId == null || t.deviceId === deviceId
      ? [
          [logMinuteIndex(grid, t.start), logMinuteIndex(grid, t.end)] as [
            number,
            number,
          ],
        ]
      : [],
  );
}

export const inMinutes = (ranges: readonly [number, number][], i: number) =>
  ranges.some(([from, to]) => i >= from && i < to);

/**
 * Every *location's* per-minute level as running totals — the cumulative acoustic
 * energy up to each minute, the minutes that actually had a reading, and the minutes a
 * monitor was standing there at all.
 *
 * A location's level for a minute is the loudest of the monitors assigned to it then, in the
 * *finest* window — always eq_fast (see eqColumn), whatever the picker says. That is the
 * quantity the card leads with, and the one the chart fills the area under while the finest
 * window is what it is drawing (loudestColumn draws the same envelope), so the number and
 * the picture are one statement in the ordinary case rather than two derivations that can
 * drift. Pick a coarser window alone and the lead still reads the minute Leq: it is the
 * number every card is compared on, and it must not move with the picker. Its *weighting*
 * is picked — an energetic mean has room for exactly one, so there is an index per ticked
 * LAeq,Range / LCeq,Range row. It is per location and not per device because a monitor's own history
 * spans every stage it visited: averaged whole, it would print the same figure on the
 * card of every place it ever stood.
 *
 * Built once per payload, weighting and set of assignments — none of which a timeline
 * drag changes. That is what keeps the drag cheap: re-averaging the crop for every
 * location on every animation frame would be tens of thousands of 10^(v/10) over a
 * four-day event, for a number the drag moves by a minute at a time. Off a running
 * total, any crop is two subtractions.
 *
 * Typed arrays because they are one entry per minute per location, hold nothing but
 * numbers, and exist to be read hot. One entry longer than the payload, so index i is
 * "everything before minute i" and the empty range needs no special case.
 */
// The grid and the count rather than the whole payload: once the columns are summed
// nothing re-walks them, and saying so in the type is what keeps that true. Carrying
// the grid at all — rather than taking it beside the index at every call — is what
// makes it impossible to read a range out of an index built for another project.
export type LocationEnergyIndex = {
  grid: LogGrid;
  minutes: number;
  locations: Record<
    string,
    {energy: Float64Array; measured: Int32Array; assigned: Int32Array}
  >;
};

export function locationEnergyIndex(
  logs: ProjectLogs,
  weighting: Weighting,
  locations: readonly LocationAssignments[],
): LocationEnergyIndex {
  const {minutes} = logs;
  const out: LocationEnergyIndex['locations'] = {};
  for (const location of locations) {
    // The loudest reading at each minute, and whether there was one — `loudest` alone
    // could not tell a genuine 0 dB from an untouched slot.
    const loudest = new Float64Array(minutes);
    const heard = new Uint8Array(minutes);
    // Whether anyone was standing here, which is what the coverage caveat is measured
    // against: a location that had no monitor for half the crop should say so, rather
    // than being charged for minutes nobody was ever going to report.
    const covered = new Uint8Array(minutes);

    for (const a of location.assignments) {
      // Half-open and clamped into the payload, like every other range here: the
      // minute containing `end` belongs to whoever took over.
      const from = Math.max(0, logMinuteIndex(logs, a.start));
      const to =
        a.end == null
          ? minutes
          : Math.min(minutes, logMinuteIndex(logs, a.end));
      const values = eqColumn(logs, a.deviceId, weighting);
      const skip = ignoredMinutes(logs, location, a.deviceId);
      for (let i = from; i < to; i++) {
        if (inMinutes(skip, i)) continue;
        covered[i] = 1;
        const v = values?.[i];
        if (!usableDb(v)) continue;
        // dB is monotonic in energy, so the loudest in dB is the loudest full stop —
        // no need to convert before comparing.
        if (!heard[i] || v > loudest[i]!) {
          loudest[i] = v;
          heard[i] = 1;
        }
      }
    }

    const energy = new Float64Array(minutes + 1);
    const measured = new Int32Array(minutes + 1);
    const assigned = new Int32Array(minutes + 1);
    for (let i = 0; i < minutes; i++) {
      energy[i + 1] = energy[i]! + (heard[i] ? toEnergy(loudest[i]!) : 0);
      measured[i + 1] = measured[i]! + (heard[i] ? 1 : 0);
      assigned[i + 1] = assigned[i]! + (covered[i] ? 1 : 0);
    }
    out[location.id] = {energy, measured, assigned};
  }
  return {grid: logs, minutes, locations: out};
}

/**
 * The Leq a location measured over a window: the energetic mean of its per-minute
 * loudest, over the minutes that actually had a reading.
 *
 * Nulls are skipped rather than counted as silence, so a stretch when the monitor here
 * was offline is left out of the average rather than dragging it down. That is what
 * makes the coverage alongside part of the answer and not a decoration — and here it is
 * measured against the minutes a monitor was *assigned* here, so a place that stood
 * empty for half the crop says so instead of quietly averaging the half it had.
 *
 * The mean is the one energeticMeanDb defines; it is read off the index rather than
 * computed here so that a crop costs the same whether it spans a minute or a festival.
 */
export function locationRangeTotals(
  index: LocationEnergyIndex,
  locationId: string,
  range: {start: number; end: number},
): RangeTotals | null {
  const location = index.locations[locationId];
  if (!location) return null;
  // Half-open and clamped into the payload: the minute containing `end` is not
  // included.
  const from = Math.max(0, logMinuteIndex(index.grid, range.start));
  const to = Math.min(index.minutes, logMinuteIndex(index.grid, range.end));
  if (from >= to) return null;
  // How many of those minutes the mean actually had to work with, which is also what
  // says whether there is a mean at all.
  const minutes = location.measured[to]! - location.measured[from]!;
  if (minutes === 0) return null;
  const db = fromEnergy(
    (location.energy[to]! - location.energy[from]!) / minutes,
  );
  return {
    db,
    minutes,
    expectedMinutes: location.assigned[to]! - location.assigned[from]!,
  };
}

/**
 * What each device read at the playhead, in one series — the number the pins carry and
 * the coloured one on each row.
 *
 * Devices with no value are left out rather than carried as null: absent and
 * unmeasured render identically, and every consumer keys on presence. Same shape the
 * three deleted queries used to hand over, which is what keeps this out of the leaf
 * components.
 */
export function levelsByDevice(
  logs: ProjectLogs,
  {
    series,
    // The playhead's minute, not its instant: the payload has no finer resolution, so
    // the caller resolves it once and can then hold this answer still for every frame
    // of a hover that stays inside the same minute (see useProjectLogs).
    minute,
  }: {
    series: SeriesKey;
    minute: number;
  },
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const deviceId of Object.keys(logs.devices)) {
    const db = logColumn(logs, deviceId, series)?.[minute];
    if (db != null) out[deviceId] = db;
  }
  return out;
}

/**
 * Every series at the playhead, for every device — what a location's header prints and,
 * behind it, the rest of what the instant holds (see LocationReadings).
 *
 * One record and not a call per series at the leaves: the minute is the same for all of
 * them, the columns are all already in memory, and a page-wide answer is what keeps a
 * card's tooltip from re-deriving what the card beside it just did. The whole thing costs
 * one index per device per series, which is why it is cheaper than the single-series
 * version was to key on the pick — see useProjectLogs, where this depends on the minute
 * alone and so survives every change to what the header is showing.
 *
 * Every series gets a key, the pick being no part of this; within one, only the devices
 * that read something — the same "absent rather than null" rule as levelsByDevice, one
 * level deeper, so a consumer keys on presence throughout.
 */
export type PlayheadLevels = Partial<Record<SeriesKey, Record<string, number>>>;

export function seriesLevelsByDevice(
  logs: ProjectLogs,
  {minute}: {minute: number},
): PlayheadLevels {
  const out: PlayheadLevels = {};
  for (const series of SERIES_KEYS) {
    out[series] = levelsByDevice(logs, {series, minute});
  }
  return out;
}

/**
 * What each location averaged over the whole crop — the tile a picked `Leq,Range` prints.
 * Its own record, and not a mode of the one above,
 * because the two answer different questions and change on different things: this one
 * ignores the playhead, that one ignores the crop.
 */
export function totalsByLocation(
  index: LocationEnergyIndex,
  range: {start: number; end: number},
): Record<string, RangeTotals> {
  const out: Record<string, RangeTotals> = {};
  for (const locationId of Object.keys(index.locations)) {
    const totals = locationRangeTotals(index, locationId, range);
    if (totals != null) out[locationId] = totals;
  }
  return out;
}

/**
 * A location's running Leq on the same minute grid the traces use (see logSeries) — the line
 * a picked `Leq,Range` draws. At each minute, the energetic mean from an *anchor* up to and
 * including that minute:
 *
 *   inside a limit written against this `Leq,Range` (`windows`), the limit's own start —
 *     so what is drawn under the rule is exactly what the rule is judged on, the Leq of the
 *     limit's hours so far. Where two overlap, the one limitAt would judge by: the strictest,
 *     and of equally strict ones the earlier.
 *   everywhere else, `start` — the crop's, so at the crop's last minute the line is the
 *     number on the tile. (Not where the crop ends inside a limit: there the line is that
 *     limit's Leq, which is the price of there being one line rather than two.)
 *
 * The same mean locationRangeTotals takes, over a window that grows a minute at a time. Null
 * before the anchor and until the first minute there was a reading; flat, not broken, through
 * a stretch nobody heard or that was ignored, since neither adds to the mean.
 *
 * Runs to the end of the payload rather than the crop's end, so dragging the end leaves it
 * untouched: past the crop nothing is drawn anyway.
 */
export function runningLeq(
  index: LocationEnergyIndex,
  locationId: string,
  start: number,
  windows: readonly {decibels: number; start: number; end: number}[] = [],
): (number | null)[] {
  const out = new Array<number | null>(index.minutes).fill(null);
  const location = index.locations[locationId];
  if (!location) return out;
  const from = Math.max(0, logMinuteIndex(index.grid, start));
  // Where each minute's mean starts. Written least strict first, so the strictest window over
  // a minute is the last to claim it — and of equals the earlier, written after the later.
  const anchor = new Int32Array(index.minutes).fill(from);
  const ranked = [...windows].sort(
    (a, b) => b.decibels - a.decibels || b.start - a.start,
  );
  for (const w of ranked) {
    const a = Math.max(0, logMinuteIndex(index.grid, w.start));
    const b = Math.min(index.minutes, logMinuteIndex(index.grid, w.end));
    for (let i = a; i < b; i++) anchor[i] = a;
  }
  const {energy, measured} = location;
  for (let i = 0; i < index.minutes; i++) {
    const at = anchor[i]!;
    if (i < at) continue;
    const minutes = measured[i + 1]! - measured[at]!;
    if (minutes === 0) continue;
    out[i] = fromEnergy((energy[i + 1]! - energy[at]!) / minutes);
  }
  return out;
}

// A location's limits written against one weighting's `Leq,Range`.
export const rangeLimits = (
  limits: readonly LimitLine[],
  weighting: Weighting,
): LimitLine[] => limits.filter((l) => l.series === rangeKey(weighting));

// Every location's running Leq from one start, each restarting inside its own `Leq,Range`
// limits for this index's weighting (see runningLeq).
export function runningLeqByLocation(
  index: LocationEnergyIndex,
  weighting: Weighting,
  start: number,
  locations: readonly {id: string; limits: readonly LimitLine[]}[],
): Record<string, (number | null)[]> {
  const out: Record<string, (number | null)[]> = {};
  for (const {id, limits} of locations) {
    if (!index.locations[id]) continue;
    out[id] = runningLeq(index, id, start, rangeLimits(limits, weighting));
  }
  return out;
}

// A `Leq,Range` limit its hours broke, and the Leq they came to.
export type RangeVerdict = {limit: LimitLine; db: number};

/**
 * The `Leq,Range` limits a location is over, for one weighting, loudest overshoot first:
 * each judged on the energetic mean of its own hours — as much of them as has been measured,
 * locationRangeTotals clamping to the end of the payload — rather than on the crop's. Only
 * those that overlap `crop`, since the card saying so is showing that stretch.
 */
export function rangeLimitVerdicts(
  index: LocationEnergyIndex,
  weighting: Weighting,
  location: {id: string; limits: readonly LimitLine[]},
  crop: {start: number; end: number},
): RangeVerdict[] {
  const out: RangeVerdict[] = [];
  for (const limit of rangeLimits(location.limits, weighting)) {
    if (limit.start >= crop.end || limit.end <= crop.start) continue;
    const totals = locationRangeTotals(index, location.id, limit);
    if (totals && exceedsLimit(totals.db, limit.decibels)) {
      out.push({limit, db: totals.db});
    }
  }
  return out.sort(
    (a, b) => b.db - b.limit.decibels - (a.db - a.limit.decibels),
  );
}

/**
 * Every picked series' traces: one device's trace per series, at full stored resolution
 * over the whole project — what the list draws behind its rows.
 *
 * Keyed by series on the outside because that is how a chart reads it (one colour, one
 * block of columns; see series.ts) and because it is what lets a series the payload never
 * carried be an empty record rather than a hole in the middle of a column list. Every
 * *requested* series gets an entry, so "asked for and absent" is distinguishable from
 * "not asked for".
 *
 * The 5m and 30m lines are read straight out of their own columns rather than rolled
 * up from the 1m one: the device reports those trailing windows itself, so averaging
 * the minutes here would both average twice and disagree with the number printed on
 * the row beside the chart.
 *
 * Deliberately not cropped or downsampled here. uPlot clips to its own x-scale by
 * binary search and reduces to min/max per pixel column, so a crop change costs it a
 * redraw and costs this nothing: the traces depend only on the payload and the pick,
 * which is what makes dragging the timeline free. It also draws the peaks an averaged
 * bucket would have flattened.
 *
 * The x column is built once and shared by every device *and* every series — hence
 * `stepMs` in the payload, and hence nulls for the minutes a device has nothing.
 */
export type SeriesTraces = Partial<
  Record<SeriesKey, Record<string, DeviceSeries>>
>;

export function logSeries(
  logs: ProjectLogs,
  picked: readonly SeriesKey[],
): SeriesTraces {
  // Epoch seconds, uPlot's x unit. Above both loops: one grid for the whole projection is
  // what the aligners rely on (see alignedSeries), and a copy per picked series of a
  // four-day festival's minutes would be several arrays of the same numbers.
  const xs = Array.from(
    {length: logs.minutes},
    (_, i) => logMinuteAt(logs, i) / 1000,
  );
  const out: SeriesTraces = {};
  for (const key of picked) {
    const devices: Record<string, DeviceSeries> = {};
    for (const deviceId of Object.keys(logs.devices)) {
      const db = logColumn(logs, deviceId, key);
      if (db) devices[deviceId] = {xs, db};
    }
    out[key] = devices;
  }
  return out;
}
