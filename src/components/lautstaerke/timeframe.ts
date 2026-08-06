import {format, roundToNearestMinutes} from 'date-fns';
import {TZDate, tz} from '@date-fns/tz';
import {locale, timeZone} from '../../utils/dateUtils';

// The viewed timeframe lives in the URL as two ISO-8601 UTC instants
// (?start=…Z&end=…Z), which is what the history query ranges over. `timeZone`
// stays the *display* timezone: chart ticks, the picker's fields, and the menu's
// labels are all local. These helpers are the single bridge between the two, and
// are deliberately client-safe so the picker can build URLs and the loader can
// parse them.
//
// TZDate does the wall-clock↔instant work: its component constructor reads the
// fields as local time in the given zone, and `tz()` is the context date-fns
// formats in. That keeps every conversion DST-correct (a local day can be 23 or
// 25 hours long) without any offset arithmetic here.

// A minute-resolution range is ~1440 rows/day; a month would be ~44k rows of
// ten columns. Cap what one request may ask for rather than downsampling.
export const MAX_RANGE_DAYS = 7;
export const MAX_RANGE_MS = MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;

export const MINUTE_MS = 60_000;
export const QUARTER_MINUTES = 15;
const QUARTER_MS = QUARTER_MINUTES * MINUTE_MS;

// Lands on a wall-clock :00/:15/:30/:45 in `timeZone`, whatever the offset.
export const snapToQuarter = (ms: number): number =>
  roundToNearestMinutes(ms, {
    nearestTo: QUARTER_MINUTES,
    in: tz(timeZone),
  }).getTime();

// The minute an instant falls in. Both sides of the level query floor to it — the
// client to key the request, the server to find the aggregate — so it has to mean
// the same thing in both places.
export const floorToMinute = (ms: number): number =>
  Math.floor(ms / MINUTE_MS) * MINUTE_MS;

const clampTo = (ms: number, min: number, max: number): number =>
  Math.min(Math.max(ms, min), max);

// Local wall-clock fields → the instant they denote in `timeZone`.
const zonedInstant = (
  y: number,
  mo: number,
  d: number,
  h = 0,
  min = 0,
): Date => new Date(new TZDate(y, mo - 1, d, h, min, timeZone).getTime());

// The URL shape, in one place: both navigate() callers and the legacy redirect
// go through this, so the param names and encoding live here alone. TZDate's own
// toISOString() renders an offset (…+02:00), hence the plain-Date round trip in
// zonedInstant — the URL is always Z-suffixed UTC.
export function rangeSearch(range: {start: Date; end: Date}): {
  start: string;
  end: string;
} {
  return {start: range.start.toISOString(), end: range.end.toISOString()};
}

// yyyy-mm-dd (local) → the search-param pair spanning that whole local day.
// Only the legacy /$device/$date redirect still speaks in whole days.
export function dayRangeSearch(date: string): {start: string; end: string} {
  const [y, m, d] = date.split('-').map(Number);
  return rangeSearch({
    start: zonedInstant(y, m, d),
    // Day d+1 overflows the month correctly, as with Date.UTC.
    end: zonedInstant(y, m, d + 1),
  });
}

// Narrow raw search params (or a server-fn payload) into instants. Null unless
// both parse, the range is non-empty, and it's within the cap — this is the one
// definition of "a valid timeframe", so the router's validateSearch, the server
// fn, and anything else all inherit the same rules. The absence of a valid range
// is what selects the live view, so a bad one degrades to live rather than 404ing.
export function parseRangeSearch(search: {
  start?: unknown;
  end?: unknown;
}): {start: Date; end: Date} | null {
  if (typeof search.start !== 'string' || typeof search.end !== 'string') {
    return null;
  }
  const start = new Date(search.start);
  const end = new Date(search.end);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const span = end.getTime() - start.getTime();
  if (span <= 0 || span > MAX_RANGE_MS) return null;
  return {start, end};
}

// `<input type="datetime-local">` bridge. The input is timezone-naive, and we
// want its wall-clock to mean festival-local time wherever the viewer sits.
const LOCAL_INPUT_FMT = "yyyy-MM-dd'T'HH:mm";

export function toLocalInput(ms: number): string {
  return format(ms, LOCAL_INPUT_FMT, {in: tz(timeZone)});
}

// Null when the field is empty or partial — browsers can hand back either.
export function fromLocalInput(value: string): Date | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, min] = m.map(Number);
  return zonedInstant(y, mo, d, h, min);
}

// Every start/end pair the section shows a human is formatted here, at one of two
// precisions. `formatRange` collapses the parts the two ends share, so a
// within-one-day timeframe reads "01.08., 18:00–21:30" and a project spanning one
// August reads "31.07.–03.08.2026". The explicit timeZone makes both deterministic
// across server and client, so neither needs suppressHydrationWarning.

// A NoiseProject's window: day precision, because a project spans festival days.
const projectRangeFmt = new Intl.DateTimeFormat(locale, {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function formatProjectRange(startMs: number, endMs: number): string {
  return projectRangeFmt.formatRange(new Date(startMs), new Date(endMs));
}

// A viewed timeframe: minute precision, and no year — it's nearly always today.
const timeframeRangeFmt = new Intl.DateTimeFormat(locale, {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatTimeframeRange(startMs: number, endMs: number): string {
  return timeframeRangeFmt.formatRange(new Date(startMs), new Date(endMs));
}

// A single instant at minute precision, for the timeline's playhead readout.
const instantFmt = new Intl.DateTimeFormat(locale, {
  timeZone,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatInstant(ms: number): string {
  return instantFmt.format(new Date(ms));
}

// Said by the project dialog, the timeframe picker, and the server-side project
// validator, so it lives with the range semantics rather than in three places.
export const END_BEFORE_START = 'Das Ende muss nach dem Beginn liegen.';

// ---------------------------------------------------------------------------
// A project page's selection: a sub-range of the project's window plus a cursor
// inside it. Lives in the URL as three ISO-UTC instants, the same encoding the
// device view's ?start/?end already uses.
// ---------------------------------------------------------------------------

export type ProjectSelectionSearch = {
  start?: string;
  end?: string;
  current?: string;
};

// Shape-only, because validateSearch runs before the loader knows the project's
// window. Anything unparseable is dropped rather than rejected, so a mangled URL
// degrades to the default selection instead of 404ing.
export function parseProjectSelectionSearch(search: {
  start?: unknown;
  end?: unknown;
  current?: unknown;
}): ProjectSelectionSearch {
  const iso = (v: unknown) =>
    typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined;
  const out: ProjectSelectionSearch = {};
  const start = iso(search.start);
  const end = iso(search.end);
  const current = iso(search.current);
  if (start) out.start = start;
  if (end) out.end = end;
  if (current) out.current = current;
  return out;
}

// The part of a project you can actually pick in: never past the current time,
// because there are no measurements in the future. `end` is floored at `start` so
// a project that hasn't begun yet collapses to a point rather than inverting —
// the slider handles a degenerate window, an inverted one it would not.
export function visibleProjectWindow(
  project: {start: number; end: number},
  nowMs: number,
): {start: number; end: number} {
  return {
    start: project.start,
    end: Math.max(project.start, Math.min(project.end, nowMs)),
  };
}

export type ProjectSelection = {start: number; current: number; end: number};

// Everything the UI needs, clamped into the project window and ordered. Defaults
// are the whole window with the cursor at its start — deliberately not `now`,
// which would differ between the server render and the client and so would have
// to be a post-mount effect.
export function resolveProjectSelection(
  search: ProjectSelectionSearch,
  window: {start: number; end: number},
): ProjectSelection {
  const at = (v: string | undefined, fallback: number) =>
    v ? Date.parse(v) : fallback;

  const start = at(search.start, window.start);
  // orderSelection does the clamping and the ordering, so a hand-edited URL with
  // the ends swapped collapses the range rather than inverting it.
  return orderSelection(
    {start, end: at(search.end, window.end), current: at(search.current, start)},
    window,
  );
}

// The slider's thumbs, and back again. The thumb count depends on the mode — live
// mode has no instant to point at, so it drops the cursor and leaves [start, end]
// — which means the indices aren't fixed and these two are the only places that
// know the mapping.
export const selectionThumbs = (
  selection: ProjectSelection,
  live: boolean,
): number[] =>
  live
    ? [selection.start, selection.end]
    : [selection.start, selection.current, selection.end];

export const thumbsToSelection = (
  thumbs: number[],
  live: boolean,
  previous: ProjectSelection,
): ProjectSelection =>
  live
    ? // The cursor is carried over, not discarded: it stays in the URL so turning
      // live off again returns to the instant you were last looking at.
      {start: thumbs[0]!, end: thumbs[1]!, current: previous.current}
    : {start: thumbs[0]!, current: thumbs[1]!, end: thumbs[2]!};

// Clamp into the window and restore start <= current <= end. The slider won't let
// thumbs cross, so this is a safety net for typed input and hand-edited URLs.
const orderSelection = (
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection => {
  const start = clampTo(selection.start, window.start, window.end);
  const end = Math.max(clampTo(selection.end, window.start, window.end), start);
  return {start, end, current: clampTo(selection.current, start, end)};
};

// What the slider commits on release. Only what the user actually moved snaps to a
// quarter hour: the fields still accept an exact time, so dragging the cursor must
// not quietly round a start that was typed in as 18:07, and re-snapping an
// untouched bound would fight manual entry.
export function commitProjectSelection(
  next: ProjectSelection,
  previous: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  const moved = (key: keyof ProjectSelection) =>
    next[key] === previous[key] ? next[key] : snapToQuarter(next[key]);
  return orderSelection(
    {start: moved('start'), end: moved('end'), current: moved('current')},
    window,
  );
}

// What a manual date/time field commits: the exact minute typed, never snapped —
// rounding what someone deliberately typed is worse than an unaligned bound. The
// opposite end is pushed along if the two would otherwise cross.
export function setProjectBound(
  which: 'start' | 'end',
  at: number,
  selection: ProjectSelection,
  window: {start: number; end: number},
): ProjectSelection {
  // The min/max is what pushes the opposite end along when the two would cross;
  // orderSelection then clamps both into the window.
  return orderSelection(
    which === 'start'
      ? {...selection, start: at, end: Math.max(selection.end, at)}
      : {...selection, start: Math.min(selection.start, at), end: at},
    window,
  );
}

export function projectSelectionSearch(
  selection: ProjectSelection,
): Required<ProjectSelectionSearch> {
  return {
    start: new Date(selection.start).toISOString(),
    end: new Date(selection.end).toISOString(),
    current: new Date(selection.current).toISOString(),
  };
}

// The range a freshly-opened picker should offer when there is none yet (the live
// view): the last hour, ending at the current minute.
export function defaultRange(nowMs: number): {start: Date; end: Date} {
  const end = floorToMinute(nowMs);
  return {start: new Date(end - 60 * MINUTE_MS), end: new Date(end)};
}
