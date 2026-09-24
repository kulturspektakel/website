import {logMinuteAt, logMinuteIndex, type ProjectLogs} from './noise';
import {logColumn, type LocationAssignments} from './projectLogs';
import type {LimitLine} from './limitLines';
import type {SeriesKey} from './series';

// Where a project has readings and where it does not — the shading behind the project
// timeline's ticks (see TimelineMarkers) — and where what it read broke a limit. React-free and beside projectLogs.ts for the
// same reason: the maths lives apart from the hook that decides when to run it.
//
// It costs one pass over the payload, once, and nothing after that. The whole event is
// already in the browser as a minute grid with no timestamps in it (see ProjectLogs), so
// "was anything heard at minute i" is an index rather than a search, and the answer
// depends on the payload and which places are asked about — never on the crop or the
// playhead, so a drag re-lays it out and recomputes nothing.

// A stretch nobody reported in, in epoch milliseconds. Half-open, like every range in
// this section: `end` is the first instant that has a reading again.
export type LogGap = {start: number; end: number};

// The column presence is read off, and it is deliberately not resolved through the series
// table: NoiseLog.laeq is non-nullable in the database, so a non-null `laeq_1m` at
// minute i means exactly "a row was stored for that minute". Every other column can be
// null for a reason that is not absence — the trailing 5m and 30m windows are null until
// the device's own ring buffer has filled — so any of them would report a monitor that
// had only just been switched on as silent. Keying on this one is also what keeps the
// shading still while the header's two pickers move.
const PRESENCE_COLUMN = 'laeq_1m';

// The minutes each placement of `locations` covers, clamped into the payload: half-open,
// so the minute containing `end` belongs to whoever took over — the same rule
// locationEnergyIndex keeps.
function assignmentMinutes(
  logs: ProjectLogs,
  a: LocationAssignments['assignments'][number],
): [number, number] {
  const from = Math.max(0, logMinuteIndex(logs, a.start));
  const to =
    a.end == null
      ? logs.minutes
      : Math.min(logs.minutes, logMinuteIndex(logs, a.end));
  return [from, to];
}

// The minutes flagged in `mask` as ascending spans in epoch ms. One entry per stretch
// rather than per minute: a four-day festival is ~5,800 minutes and a handful of outages.
// A run still open at the end closes at the payload's own edge, which is the furthest
// this may speak for.
function runs(logs: ProjectLogs, mask: Uint8Array): LogGap[] {
  const out: LogGap[] = [];
  let from: number | null = null;
  for (let i = 0; i < logs.minutes; i++) {
    if (mask[i]) {
      from ??= i;
      continue;
    }
    if (from != null) out.push({start: logMinuteAt(logs, from), end: logMinuteAt(logs, i)}); // prettier-ignore
    from = null;
  }
  if (from != null) {
    out.push({
      start: logMinuteAt(logs, from),
      end: logMinuteAt(logs, logs.minutes),
    });
  }
  return out;
}

/**
 * The stretches of a payload no monitor reported in.
 *
 * Without `locations`, a union across every device in the project — what the map asks,
 * whose pins are every place at once. No assignment logic is needed to make that a fair
 * question: projectLogs already clips each column to the spans its device was actually
 * deployed for, so a monitor sitting in a cupboard contributes nulls.
 *
 * With them, only what was heard *at* those places: each monitor counts for the minutes it
 * stood at one of them, and not for the rest of the event it spent elsewhere. That is the
 * list's question, whose cards are only the places picked for it.
 *
 * Bounded to the payload, and that bound is load-bearing. Past `minutes` we do not know
 * anything, and on a running festival the timeline's window keeps advancing (its right
 * edge is the clock) while the payload stays pinned — so claiming that tail would grow a
 * fake outage at the right of the strip over the course of a session.
 */
export function coverageGaps(
  logs: ProjectLogs,
  locations?: readonly LocationAssignments[],
): LogGap[] {
  const {minutes} = logs;
  const heard = new Uint8Array(minutes);
  if (locations == null) {
    for (const device of Object.values(logs.devices)) {
      // Absent entirely is the ordinary case for a column that was null throughout, so a
      // device with nothing to say is skipped rather than walked.
      const values = device[PRESENCE_COLUMN];
      if (!values) continue;
      for (let i = 0; i < minutes; i++) if (values[i] != null) heard[i] = 1;
    }
  } else {
    for (const location of locations) {
      for (const a of location.assignments) {
        const values = logs.devices[a.deviceId]?.[PRESENCE_COLUMN];
        if (!values) continue;
        const [from, to] = assignmentMinutes(logs, a);
        for (let i = from; i < to; i++) if (values[i] != null) heard[i] = 1;
      }
    }
  }
  const silent = heard.map((h) => (h ? 0 : 1));
  return runs(logs, silent);
}

/**
 * The stretches where one of `locations` read louder than a limit in force there, in
 * `series` — or null when none of them has a limit written against that series at all,
 * which is a strip with nothing to say about limits rather than one that says "all clear".
 *
 * A place's reading at a minute is the loudest of the monitors standing there then, as its
 * chart draws it; over *any* limit in force is over the strictest of them, the same rule the
 * map's pins warn by (see strictestLimit). Strictly above: a reading that sits exactly on
 * its limit is within it.
 */
export function limitBreaches(
  logs: ProjectLogs,
  locations: readonly (LocationAssignments & {
    limits: readonly LimitLine[];
  })[],
  series: SeriesKey,
): LogGap[] | null {
  const {minutes} = logs;
  const over = new Uint8Array(minutes);
  let limited = false;
  for (const location of locations) {
    const limits = location.limits.filter((l) => l.series === series);
    if (limits.length === 0) continue;
    limited = true;

    // The loudest reading at each minute; NaN where nobody here read anything, which
    // compares false against every limit.
    const loudest = new Float64Array(minutes).fill(NaN);
    for (const a of location.assignments) {
      const values = logColumn(logs, a.deviceId, series);
      if (!values) continue;
      const [from, to] = assignmentMinutes(logs, a);
      for (let i = from; i < to; i++) {
        const v = values[i];
        if (v != null && !(v <= loudest[i]!)) loudest[i] = v;
      }
    }

    for (const limit of limits) {
      const from = Math.max(0, logMinuteIndex(logs, limit.start));
      const to = Math.min(minutes, logMinuteIndex(logs, limit.end));
      for (let i = from; i < to; i++) {
        if (loudest[i]! > limit.decibels) over[i] = 1;
      }
    }
  }
  return limited ? runs(logs, over) : null;
}

/**
 * The gaps worth drawing on an axis `widthPx` wide, each at least `minPx` across.
 *
 * Widened rather than dropped, which is the whole decision here. A flaky monitor's
 * one-minute holes are sub-pixel individually on a multi-day project, and dropping them
 * would draw a clean strip over swiss cheese — the one reading of this shading that would
 * be actively wrong. Widening overstates how *wide* a hole is by a pixel or two; it can
 * neither invent one nor hide one, which is the right trade for a strip you glance at.
 *
 * Merging afterwards is also what caps the DOM: at `minPx` of 2 the output cannot exceed
 * about half as many spans as the axis has pixels, however ragged the data.
 *
 * Clamped into `window` last, so a gap widened at either end still stops on the axis.
 */
export function thinGaps(
  gaps: readonly LogGap[],
  window: {start: number; end: number},
  widthPx: number,
  minPx: number,
): LogGap[] {
  const span = window.end - window.start;
  if (!(widthPx > 0) || !(span > 0)) return [];
  const minMs = (minPx / widthPx) * span;

  const out: LogGap[] = [];
  for (const gap of gaps) {
    // Around its own middle, so a widened hole still stands where the hole is.
    const grow = Math.max(0, minMs - (gap.end - gap.start)) / 2;
    const start = Math.max(window.start, gap.start - grow);
    const end = Math.min(window.end, gap.end + grow);
    if (end <= start) continue;
    // The gaps arrive in ascending order — coverageGaps walks the payload once — so the
    // merge only ever has to look at the last one written.
    const last = out[out.length - 1];
    if (last && start <= last.end) last.end = Math.max(last.end, end);
    else out.push({start, end});
  }
  return out;
}
