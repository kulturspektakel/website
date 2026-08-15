import {format, roundToNearestMinutes} from 'date-fns';
import {TZDate, tz} from '@date-fns/tz';
import {locale, timeZone} from '../../utils/dateUtils';

// Instants, and the wall clock they are shown and typed in. Everything stored is an
// instant; `timeZone` is the *display* zone, so chart ticks, a dialog's fields and every
// range a human reads are festival-local wherever the viewer sits. These helpers are the
// single bridge between the two.
//
// TZDate does the wall-clock↔instant work: its component constructor reads the
// fields as local time in the given zone, and `tz()` is the context date-fns
// formats in. That keeps every conversion DST-correct (a local day can be 23 or
// 25 hours long) without any offset arithmetic here.
//
// A timeframe used to live in the URL as two ISO instants, for the device page's
// historical view; nothing carries one now — the project page keeps its crop in state
// (see projectSelection.ts), and the device page shows only what is arriving.

export const MINUTE_MS = 60_000;
export const QUARTER_MINUTES = 15;

// Lands on a wall-clock :00/:15/:30/:45 in `timeZone`, whatever the offset.
export const snapToQuarter = (ms: number): number =>
  roundToNearestMinutes(ms, {
    nearestTo: QUARTER_MINUTES,
    in: tz(timeZone),
  }).getTime();

// Exported for projectSelection.ts, which clamps a three-thumb selection into
// the project's window with the same rule.
export const clampTo = (ms: number, min: number, max: number): number =>
  Math.min(Math.max(ms, min), max);

// Local wall-clock fields → the instant they denote in `timeZone`.
const zonedInstant = (y: number, mo: number, d: number, h = 0, min = 0): Date =>
  new Date(new TZDate(y, mo - 1, d, h, min, timeZone).getTime());

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

// A single instant at minute precision, carrying its weekday and date whatever the
// window around it — the timeline's playhead thumbs say this to a screen reader, which
// has no strip in front of it to take the day from. What that readout *prints* is
// chartUtils' instantLabel, so that it and the row charts' tooltip agree.
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

// Said by the project dialog and by the server-side validator behind it, so it lives with
// the range semantics rather than in both.
export const END_BEFORE_START = 'Das Ende muss nach dem Beginn liegen.';
