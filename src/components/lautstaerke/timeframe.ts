import {format} from 'date-fns';
import {TZDate, tz} from '@date-fns/tz';
import {timeZone} from '../../utils/dateUtils';

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

// The range a freshly-opened picker should offer when there is none yet (the live
// view): the last hour, ending at the current minute.
export function defaultRange(nowMs: number): {start: Date; end: Date} {
  const end = Math.floor(nowMs / 60_000) * 60_000;
  return {start: new Date(end - 60 * 60_000), end: new Date(end)};
}
