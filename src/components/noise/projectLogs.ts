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
// the weighting the caller asked for, which for the crop's Leq is the primary pick's —
// one mean cannot be in two.
const eqColumn = (logs: ProjectLogs, deviceId: string, weighting: Weighting) =>
  logColumn(logs, deviceId, seriesKey('eq_fast', weighting));

// A crop's Leq for one device, carrying how much of the crop it was actually
// measured over — which is the caveat that keeps the number honest.
export type RangeTotals = {db: number} & Coverage;

// A location and the placements whose readings count as its own — the same windows the
// chart's lines are clipped to (see maskToWindows), in the shape the index needs.
export type LocationAssignments = {
  id: string;
  assignments: readonly {
    deviceId: string;
    start: number;
    end: number | null;
  }[];
};

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
 * does follow the pick — the primary's, an energetic mean having room for exactly one —
 * which is why the card names this tile LAeq,Range or LCeq,Range rather than leaving it
 * unqualified. It is per location and not per device because a monitor's own history
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
      for (let i = from; i < to; i++) {
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
 * What each location averaged over the whole crop — the number every card leads with,
 * whatever the picker is set to. Its own record, and not a mode of the one above,
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
