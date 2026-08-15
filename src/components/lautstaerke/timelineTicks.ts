import {addDays, differenceInCalendarDays, startOfDay} from 'date-fns';
import {TZDate, tz} from '@date-fns/tz';
import {timeZone} from '../../utils/dateUtils';
import {MINUTE_MS, clampTo} from './timeframe';
import {dayOf, gridStep, hourMinuteOf, spanWithinDay} from './chartUtils';

// The time axis under the project timeline's strip: where its lines go and which of
// them get a label. Pure, and in its own file, because all of it is arithmetic on a
// calendar and none of it is arithmetic on milliseconds — see the walk below.

export type TimelineTick = {
  ms: number;
  // On the coarse tier — drawn as a longer line, and the one that carries a date when
  // the window is wide enough to need one. Which unit that is depends on the window
  // (see MAJOR_UNIT below). Read off the wall clock, not off the array: on the far side
  // of a 25-hour day an index would no longer be where midnight is.
  major: boolean;
  label: string | null;
};

const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

// The steps the axis is allowed to take, in minutes. Its invariant is not the usual
// "each divides the one above" — 120 does not divide 180 — but the one calendar
// generation actually needs: **every entry either divides the major unit or is a whole
// number of them**, for either unit that can be (an hour and a day both hold: 15 and 30
// divide 60, and everything from 60 up is a multiple of it). That is what guarantees a
// major mark is always a member of the tick set, whatever step is chosen, and so that
// the two tiers can never drift apart.
//
// It starts below an hour on purpose, and not only for narrow windows: a single-evening
// project marks its hours and wants quarters between them.
// It stops at two days because an event is one evening to a long weekend, never more.
// Dates typed wrong can still hand this any window at all, which stepFor answers rather
// than the ladder.
const STEPS_MIN = [
  15,
  30,
  60,
  2 * 60,
  3 * 60,
  4 * 60,
  6 * 60,
  12 * 60,
  DAY_MINUTES,
  2 * DAY_MINUTES,
];

// The closest two lines may sit. The strip is 44 px tall and a line on it is
// orientation rather than a scale to measure against, so this is generous: at 15 px a
// four-day festival on a phone draws six-hourly, which is a rhythm, where 8 px would
// draw three-hourly and be texture.
export const TICK_SPACE = 15;

// Roughly what a label occupies — "01.08." at the axis font, which is the widest thing
// this axis prints, so one number covers both label kinds. Exported because the markers
// clamp against it at the strip's ends, and two estimates of one string's width would
// be two things to correct when the type changes.
export const LABEL_W = 40;

// The closest two labels may sit: their own width, and then room to breathe. Arithmetic
// rather than a second constant, so the gap cannot quietly become negative.
export const LABEL_SPACE = LABEL_W + 8;

// Where a value stands between two ends, 0…1. Every position on the strip goes through
// this — the markers' lines, the thumbs' readout, and the pointer's own place on the
// control — so that a line and the thumb standing on it cannot come out a rounding
// apart. Deliberately not in instants: the pointer's copy of the question is in pixels.
export const axisFraction = (
  value: number,
  start: number,
  end: number,
): number => clampTo((value - start) / (end - start), 0, 1);

// The smallest step off the ladder that leaves `minSpacePx` between lines — gridStep's
// arithmetic, which is the same question the row charts' grid asks, with one addition.
// Past the ladder gridStep hands back the exact figure it needed, and that is the one
// thing a calendar cannot walk: you cannot step every 37.4 minutes and land on midnight.
// So an off-ladder answer is rounded up to whole days. Only a mistyped project gets
// there, and it gets a coarse but honest axis rather than a broken one.
const LADDER_MAX = STEPS_MIN[STEPS_MIN.length - 1]!;
const stepFor = (spanMinutes: number, widthPx: number, minSpacePx: number) => {
  const step = gridStep(STEPS_MIN, spanMinutes, widthPx, minSpacePx);
  return step > LADDER_MAX ? Math.ceil(step / DAY_MINUTES) * DAY_MINUTES : step;
};

// A wall clock in `timeZone` turned back into the instant it denotes — the whole point
// of this file. Building the tick from the day's own calendar fields is what keeps it
// on the clock across a DST change, where adding a fixed number of milliseconds to the
// previous tick would carry the old offset along with it.
const atMinuteOfDay = (dayStart: TZDate, minutes: number): TZDate =>
  new TZDate(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    timeZone,
  );

// The wall-clock minutes a day is cut into at `step`, which divides a day by the
// ladder's invariant. Built once per call rather than counted in the loop, so the walk
// below reads as "these minutes, on each of these days".
const minutesOfDay = (step: number): number[] =>
  Array.from({length: DAY_MINUTES / step}, (_, i) => i * step);

/**
 * The lines to draw across a timeline spanning `window`, drawn `widthPx` wide.
 *
 * Two tiers from one ladder rather than two: a tick landing on a whole major unit *is*
 * the coarse mark, so the tiers cannot disagree about where one begins, and the coarse
 * tier needs no generation rule of its own.
 *
 * Which unit that is follows the window. Across a festival the long lines are midnights
 * carrying dates, with hours between them; within a single day they are the hours
 * themselves, carrying times, with quarters between them. Same two tiers, one unit down
 * — an evening has no midnight to hang anything on, and a strip of undifferentiated
 * hour ticks would give it no rhythm to read.
 *
 * The width decides the rest. It is the only reason a four-day festival reads as four
 * days on a phone and as sixteen six-hour blocks on a laptop, and it is why this takes
 * pixels at all rather than being a function of the window alone.
 */
export function timelineTicks(
  window: {start: number; end: number},
  widthPx: number,
): TimelineTick[] {
  // Before layout there is no width to divide by, and a window that hasn't opened has
  // nothing to divide. Both are ordinary states — the strip renders on the server,
  // where there is no ResizeObserver to measure it — so they are empty rather than
  // approximate.
  if (!(widthPx > 0) || !(window.end > window.start)) return [];

  // Which unit the long lines mark, and so what the axis is an axis *of*. A festival is
  // read in days with hours between them; one evening of it is read in hours with
  // quarters between them — the same two tiers, a unit down. The threshold is the row
  // charts' own (spanWithinDay), because it answers the same question: whether two
  // points in this window could share a clock time. Sharing it is what keeps the lines
  // and the labels describing one window rather than two.
  const withinDay = spanWithinDay(window.end - window.start);
  const majorUnit = withinDay ? HOUR_MINUTES : DAY_MINUTES;

  const spanMinutes = (window.end - window.start) / MINUTE_MS;
  const tickStep = stepFor(spanMinutes, widthPx, TICK_SPACE);

  // Labels are the same ladder, further up it, and constrained to a multiple of the
  // tick step — so a label always lands on a line rather than between two, and is never
  // finer than one. There may be no such entry (nothing in the ladder above three days
  // is a multiple of three days), in which case the next multiple of the step is the
  // honest answer; that can only happen once the step is itself whole days, so midnight
  // stays labelled either way.
  const neededLabel = (spanMinutes * LABEL_SPACE) / widthPx;
  const labelStep =
    STEPS_MIN.find((step) => step >= neededLabel && step % tickStep === 0) ??
    Math.ceil(neededLabel / tickStep) * tickStep;

  // Whole days at a time once the step is a day or more, so the walk costs the number of
  // lines drawn rather than the length of the window. Below a day the stride is one and
  // the step is taken inside it — the same expression either way, since the ladder's
  // sub-day entries divide a day.
  const dayStride = Math.max(1, tickStep / DAY_MINUTES);
  const inDay = minutesOfDay(tickStep / dayStride);

  // Whether the long lines are the unit itself. They are, until the step grows as coarse
  // as the unit and every line becomes one — at which point the tier says nothing, and a
  // strip of full-height lines at the minimum spacing is the picket fence the two tiers
  // exist to avoid. Past there the emphasis moves to the lines that carry a label, which
  // are the ones there is a reason to find.
  const markTheUnit = tickStep < majorUnit;

  // How many unit marks apart two labels may stand once they are a day or more apart:
  // past that point the clock has wrapped, so minute-of-day can no longer express the
  // step and the marks have to be counted instead.
  const unitLabelStride = labelStep / DAY_MINUTES / dayStride;

  // Off a fixed anchor by a counted number of days rather than a date advanced in place:
  // the walk is then bounded by its own header, so it cannot spin, and no step
  // accumulates on the one before it.
  const firstDay = startOfDay(window.start, {in: tz(timeZone)});
  const dayCount = differenceInCalendarDays(window.end, firstDay, {
    in: tz(timeZone),
  });

  const ticks: TimelineTick[] = [];
  // Counted as unit marks are drawn rather than as days are walked, so a thinned run
  // of dates starts at the first mark the window actually contains — anchoring on the
  // calendar would let a festival whose first day is only half in view open on an
  // unlabelled date.
  let unitMarks = 0;

  for (let i = 0; i <= dayCount; i += dayStride) {
    const dayStart = addDays(firstDay, i);
    for (const minute of inDay) {
      const at = atMinuteOfDay(dayStart, minute);
      const localMinutes = at.getHours() * 60 + at.getMinutes();
      // The hour that doesn't exist. On the spring-forward day the 02:00 wall clock is
      // never reached, and asking for it hands back 01:00 — a duplicate of the line
      // before it, wearing the wrong label. A tick that isn't the minute it was built
      // from isn't a tick.
      if (localMinutes !== minute) continue;
      const ms = at.getTime();
      // Wall-clock minutes run forwards within a local day in both DST directions, so
      // the first one past the end is the last one worth building.
      if (ms > window.end) break;
      // The walk necessarily opens at the midnight before the window, so the head is
      // dropped rather than skipped.
      if (ms < window.start) continue;

      // Whether this lands on a whole unit at all — a midnight, or an hour within a day.
      const atUnit = localMinutes % majorUnit === 0;
      // Advanced here rather than inside the rule below: a unit mark counts whether or
      // not it ends up labelled, and a side effect in the arm of a conditional is how
      // that quietly stops being true.
      const unitIndex = atUnit ? unitMarks++ : -1;
      // Two anchors, deliberately: clock labels hang off midnight, so they are decided
      // by the wall clock and come out on round times whatever the window starts at;
      // dates hang off the first mark in view, because by then every one of them reads
      // 00:00 and the clock has nothing left to say.
      const labelled =
        labelStep < DAY_MINUTES
          ? localMinutes % labelStep === 0
          : atUnit && unitIndex % unitLabelStride === 0;
      // Falling back to the labelled lines rather than to a coarser modulo, because past
      // a day minute-of-day has wrapped and can no longer express one — the label rule
      // above has already done that counting.
      const major = markTheUnit ? atUnit : labelled;
      ticks.push({
        ms,
        major,
        // Bare, and not instantLabel's reading of the same instant: this is an axis, and
        // the date on the line beside it is what the hours between two of them belong
        // to. The row charts print their own axis the same way, for the same reason —
        // and drop the date on a window this narrow for the same reason too, which is
        // the very rule `withinDay` came from. Off `at`, which is already this instant in
        // `timeZone`: the formatters that take epoch seconds would resolve it a second
        // time.
        label: !labelled
          ? null
          : major && !withinDay
            ? dayOf(at)
            : hourMinuteOf(at),
      });
    }
  }

  return ticks;
}
