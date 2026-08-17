import uPlot from 'uplot';
import {useRef, type MutableRefObject} from 'react';
import {TZDate} from '@date-fns/tz';
import {locale, timeZone} from '../../utils/dateUtils';
import {themeHex} from '../../theme-noise';
import {clampTo} from './timeframe';

// All noise charts render in festival-local time regardless of the viewer's
// timezone. The data x-values are unix epoch seconds; we reinterpret them in
// `timeZone` for both tick placement (uPlot's `tzDate`) and labels.
export const zonedDate = (ts: number) => new TZDate(ts * 1000, timeZone);

// Canvas 2D rejects `var(...)` strings, so the charts want the concrete colour
// rather than the token. That resolution is theme-noise's `themeHex`, off the
// same table the Chakra tokens are generated from — see the note there for why
// it reads the theme rather than the document.

// The type every axis in this section is lettered in: small enough that a gutter costs
// less than the trace gains by being readable, which means smaller than uPlot's 12 px
// default. Split into family and size because it is set two different ways — a canvas
// font string for the row charts, CSS on the project timeline's own markers — and those
// two stand one above the other on the same page. A Chakra token would do for the second
// but not the first (a `var()` on a canvas resolves to nothing and takes the labels with
// it), and the theme's `mono` is a different stack, so the concrete list is what both
// share.
export const AXIS_FONT_SIZE = 10;
export const AXIS_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, monospace';
// The canvas form of the two above, which is how uPlot wants it.
export const AXIS_FONT = `${AXIS_FONT_SIZE}px ${AXIS_FONT_FAMILY}`;

// The dB axis, shared by the time chart and the band spectrum so the two read
// against the same scale when they sit side by side in the live view. 30 dB is
// below the noise floor of these mics and 110 above anything the festival
// produces, so a fixed range keeps the lines from rescaling as levels move.
export const dbAxis = {range: [30, 110] as const};

// The floor every chart in this section stops shrinking at. A list of two locations
// should be two tall charts rather than two short ones over a gap, so the cards divide
// the page between them and the charts follow — but a list of ten on a laptop would be
// slivers, and below this the list scrolls instead.
//
// It includes the axis under the plot, so the trace itself gets what is left — dbAxis
// spans 80 dB, which over that remainder is eight grid gaps of ~16 px each, still enough
// to read a level off the grid rather than merely be reminded there is one.
export const MIN_PLOT_HEIGHT = 160;

// uPlot needs a concrete pixel height, and the container is flex-sized, so it
// can measure 0 before layout settles — fall back rather than collapse.
export const plotHeight = (container: HTMLElement, fallback: number): number =>
  Math.max(MIN_PLOT_HEIGHT, container.clientHeight || fallback);

// uPlot's cursor coordinates are relative to the plotting area; offset by it to
// anchor a React tooltip in container coordinates.
//
// `fraction` is how far along the container that x sits, 0…1, which is what keeps a readout
// centred on it from hanging out of the box (see ChartTooltip). Resolved here because this
// is already the one place that knows both the point and the box it is in — a caller
// working it out again would be measuring the same element a second time.
//
// The same quantity axisFraction answers for the timeline, spelled out here rather than
// imported from it: timelineTicks already imports this module, and a cycle between the two
// is not worth saving one call of `clampTo`.
export const cursorAnchor = (
  u: uPlot,
  container: HTMLElement,
  left: number,
  top: number,
): {left: number; top: number; fraction: number} => {
  const over = u.over.getBoundingClientRect();
  const root = container.getBoundingClientRect();
  const x = over.left - root.left + left;
  return {
    left: x,
    top: over.top - root.top + top,
    // A container measured at zero — the frame before layout settles — would make this
    // NaN, and a NaN in a transform silently drops the whole rule.
    fraction: root.width > 0 ? clampTo(x / root.width, 0, 1) : 0.5,
  };
};

// How far a label sits off the plot it is describing — every axis in the section, both
// dimensions. uPlot measures it from the edge of the plotting area (there are no tick
// marks here to measure from), so it is the whole of the air between the grid and the
// type, and at 2 px the numbers read as if they were part of the chart rather than a
// caption to it.
export const AXIS_GAP = 6;

// What every gutter in this section costs: the air above, plus the type it has to hold —
// "110" at the font above, and one line of it under the plot. Both come out of the box,
// so the plot is that much smaller than the layout gave it, and because the two charts on
// the live view sit side by side they have to be the same two numbers or the pair's grids
// sit at different heights and its plot areas start at different offsets.
//
// Written as the gap plus what the labels need, and not as the totals they come to,
// because that is the invariant: a gutter smaller than its own sum clips the type it was
// reserved for, which is silent — uPlot draws the label into whatever room it was given
// and lets the canvas cut it off. Widen AXIS_GAP and these follow.
export const Y_AXIS_W = AXIS_GAP + 20; // "110": three characters of 6 px, and a little
export const X_AXIS_H = AXIS_GAP + 13; // one line of 10 px type, descender and all

// What a row of labels turned −45° needs instead, which is the only way to get a label
// under all 31 of the spectrum's bands: laid flat they would want a thousand pixels of
// chart. A label runs down and to the right of the band it names, so the gutter has to
// hold the diagonal — the widest of them ("1,25k", five characters of 6 px, ~30 px)
// across a 45° drop is ~21 px, plus the type's own height turned the same way.
//
// Exported because it is not the spectrum's business alone: on the device page the trace
// stands beside it, and two charts whose bottom gutters differ have their grids at
// different heights. LiveView hands this to both. See LevelTrace's `xAxisSize`.
export const X_AXIS_H_ROTATED = AXIS_GAP + 30;

// Right and top only: the axes reserve the other two. Part of what makes two charts' plot
// areas identical, so it is shared with the gutters rather than set per chart.
//
// The top is not breathing room, it is the top label's other half. dbAxis' maximum is a
// grid line exactly at the top of the plot, and uPlot centres a y label on the line it
// belongs to — so half the type stands above the plot, and above the plot is off the
// canvas unless something has reserved the room. Half the type, plus a pixel for the
// rounding, is that room, and it follows the type if the type ever changes.
//
// uPlot's own default here is a third of its default x-axis height, which is 17 px and
// covers this by accident; passing a padding at all is what gives that up. The right, in
// contrast, is chosen: it keeps the last x label off the edge of the canvas.
export const CHART_PADDING: uPlot.Padding = [
  Math.ceil(AXIS_FONT_SIZE / 2) + 1,
  8,
  0,
  0,
];

// How every axis in this section is drawn — the type, the colours, and the decision not
// to draw tick marks: at this size the grid line a label sits on is the tick, and marks
// beside it would only thicken the gutters. The project timeline letters its own markers
// in `chart.axis` too, so every axis on the page agrees by construction.
//
// A fresh object per call, and per axis: uPlot mutates the axis objects it is handed.
export const axisBase = (): uPlot.Axis => ({
  show: true,
  gap: AXIS_GAP,
  font: AXIS_FONT,
  ticks: {show: false},
  stroke: themeHex('chart.axis'),
  grid: {show: true, stroke: themeHex('chart.grid'), width: 1},
});

// Label every nth grid line, n being the fewest that leaves `minSpace` between the ones
// that survive. Measured off the first two splits — they are evenly spaced, every axis
// here having been handed a single increment — so it costs one conversion rather than a
// text measurement, and follows a rescale or a resize without being told.
//
// Every axis in the section, along either dimension: a time label is wide, a dB label is
// short but they stack, and a frequency label is one of 31 across a few hundred pixels.
// Same question, three directions to ask it in.
export const labelStride = (
  u: uPlot,
  splits: number[],
  scale: string,
  minSpace: number,
): number => {
  if (splits.length < 2) return 1;
  const gap = Math.abs(
    u.valToPos(splits[1]!, scale) - u.valToPos(splits[0]!, scale),
  );
  return gap > 0 ? Math.max(1, Math.ceil(minSpace / gap)) : 1;
};

// The horizontal grid's ladder, in dB, finest first — the same shape the time and
// frequency axes use for their own, and picked the same way: the finest step whose lines
// still clear DB_GRID_SPACE at the height the chart actually got.
//
// Height is the whole point. This axis is on a row on a card, on a panel on a device page
// and on the spectrum beside it, which is a factor of five, and a grid fixed at 10 dB
// reads as either a picket fence or two lonely lines depending on which one you opened.
// Nothing finer than 5 dB, because a dB is not a quantity anyone reads off a grid line to
// that precision — past there the lines stop being a scale and start being texture.
//
// Every step divides the one above it, so a chart that grows thins its grid out rather
// than moving every line to a new offset.
const DB_GRID_STEPS = [5, 10, 20, 40];
// The closest two lines may sit, and the closest two *numbers* may. The second is the
// larger — numbers stack where lines only need to be told apart — and the two together
// decide how many of the lines get one: the stride is at most 2 (see labelStride), LABEL
// over GRID rounded up, which is what keeps a label on a multiple of the step below it
// rather than on some third of one.
//
// The label figure is the type's own line box, 13 px at this size, and half as much again
// of air. Not more: at 26 — twice the line box — a card's chart came out with its lines
// 22 to 26 px apart and lost every other number to a threshold it missed by a pixel or
// two, which reads as a rule about the axis rather than what it was, a figure set too
// high to describe anything the type actually needs.
const DB_GRID_SPACE = 14;
const DB_LABEL_SPACE = 20;

// The dB axis, whole, for every chart drawn against dbAxis.range — the trace and the band
// spectrum, which sit side by side on the live view and so have to agree line for line.
//
// As fine as the height it was given allows: the step is decided here off `fullDim` and
// handed to uPlot as the only candidate, so its own search can't reject it (`space` is
// nominal for that reason, and non-zero because the split generator divides by it).
//
// Deciding it rather than letting uPlot decide is what makes a short row work at all:
// eight gaps across 113 px fall under any default minimum, and an increment that cannot
// have its minimum spacing is one uPlot refuses to use — it settles on zero and draws no
// axis.
//
// Not every line gets a number: they stack, so DB_LABEL_SPACE is what keeps the ones that
// remain apart, and the lines between two labels are still the grid the plot is read
// against. Bare numbers, no unit — which dB this is depends on the weighting, and the
// page's own readings say so.
export const dbLevelAxis = (): uPlot.Axis => ({
  ...axisBase(),
  size: Y_AXIS_W,
  incrs: (_self, _axisIdx, scaleMin, scaleMax, fullDim) => [
    gridStep(DB_GRID_STEPS, scaleMax - scaleMin, fullDim, DB_GRID_SPACE),
  ],
  space: 1,
  values: (u, splits) => {
    const step = labelStride(u, splits, 'y', DB_LABEL_SPACE);
    return splits.map((v, i) => (i % step ? null : String(v)));
  },
});

// Short form for a band centre, where there is room for "16k" and not for "16 kHz". The
// calibration dialog's slider labels have a whole column each and use formatBandFrequency
// instead. German throughout, so that the thirds below a kilohertz read as "31,5" rather than
// falling back to a decimal point beside the "12,5k" further along the same axis.
export const fmtHz = (f: number) =>
  f >= 1000
    ? `${(f / 1000).toLocaleString('de-DE')}k`
    : f.toLocaleString('de-DE');

// One label per band, which is what the axis is for: the bars are thirds of an octave and the
// question asked of a spectrum is which third. Laid flat they cannot be had — the widest is five
// characters of 10 px mono and there are 31 of them, which wants a thousand pixels of chart — so
// they are turned −45°, where a label needs only its own height in horizontal room.
const BAND_LABEL_ROTATE = -45;
// The closest two of those may sit, measured along the axis. A turned label clears its neighbour
// once they are the type's own height apart — 10 px across a 45° diagonal is ~14 — and below that
// the axis drops every other one rather than overprinting.
const BAND_LABEL_SPACE = 14;
// A grid line every third band — an octave, the bands being thirds of one. Not one per label: 31
// lines is a fence over the bars they are meant to place, and the eye reads a spectrum's shape
// off the bars and its position off the octaves.
const OCTAVE = 3;

/**
 * The 1/3-octave frequency axis, shared by every chart of the 31 bands — the live spectrum and
 * the calibration result, which are read against each other and so cannot letter the same bands
 * two ways.
 *
 * Takes the band centres rather than importing them, so this file stays free of the section's
 * data (it is the chart toolbox, not a chart). x values are band *indices*, which is what makes
 * the bars evenly spaced across the plot where their frequencies are not.
 *
 * A split per band is what puts a label there — uPlot only letters the splits — so the increment
 * is one and `space` is nominal, the label spacing being labelStride's business below and the
 * grid's being the filter's. An increment of 1 rather than the octave 3 also steps around
 * uPlot's own arithmetic: it rejects any increment below 5 it has no decimal count recorded for,
 * and it records only the ones off its 1 / 2 / 2.5 / 5 ladders. 1 is among them and 3 is not, and
 * an axis whose candidates are all rejected is one uPlot draws no labels, no grid and no ticks
 * for.
 */
export const bandAxis = (freqs: readonly number[]): uPlot.Axis => ({
  ...axisBase(),
  size: X_AXIS_H_ROTATED,
  rotate: BAND_LABEL_ROTATE,
  incrs: [1],
  space: 1,
  grid: {
    ...axisBase().grid,
    // Octaves only, whatever is lettered below. Same length as the splits, a null where no line
    // is wanted — see uPlot's drawOrthoLines.
    filter: (_u, splits) =>
      splits.map((v) => (Math.round(v) % OCTAVE ? null : v)),
  },
  values: (u, splits) => {
    const step = labelStride(u, splits, 'x', BAND_LABEL_SPACE);
    return splits.map((v, i) => {
      if (i % step) return null;
      const f = freqs[Math.round(v)];
      return f == null ? null : fmtHz(f);
    });
  },
});

// The x scale those bars want: half a band of air at either end, so the first and last are not
// half off the canvas. Same at both ends and shared for the same reason as the axis above.
export const bandRange = (count: number): [number, number] => [
  -0.7,
  count - 0.3,
];

const pad2 = (n: number) => String(n).padStart(2, '0');

// The two fields every axis label here is built from, off a date already resolved into
// `timeZone`. Split out from the formatters below because those spell the same digits
// three times between them, and because the project timeline reads them off a TZDate it
// has already constructed — one definition of "dd.MM.", whichever end it is asked from.
export const dayOf = (d: TZDate) =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.`;
export const hourMinuteOf = (d: TZDate) =>
  `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// The third field, and the only one not spelled out in digits here: an abbreviated
// weekday in the festival's locale, which is what a date on a readout is actually read
// as — "which night was that" rather than "which number was that". Intl and not a table
// of our own, off the same options `formatInstant` labels the timeline's thumbs with, so
// the two say the same word for the same day. A `TZDate` is a `Date`, so the formatter
// takes it directly and resolves the zone itself.
const weekdayFmt = new Intl.DateTimeFormat(locale, {
  timeZone,
  weekday: 'short',
});
export const weekdayOf = (d: TZDate) => weekdayFmt.format(d);

// HH:MM — historical chart x-axis (per-minute, within a day), in `timeZone`.
export const fmtHourMinute = (ts: number) => hourMinuteOf(zonedDate(ts));

const DAY_MS = 24 * 60 * 60 * 1000;

// Whether a window that wide can be read on the clock alone: below a day no two points
// in it can share one, at a day or more the same time comes round again. Keyed on the
// span rather than on the data, because that is the whole of what decides it.
//
// Its own function because it settles more than a label. The project timeline's axis
// asks the same question to pick which unit its long lines mark — days across a
// festival, hours within one evening — and an axis whose lines said "day" while its
// labels said "time" would be describing two different windows.
export const spanWithinDay = (spanMs: number): boolean => spanMs < DAY_MS;

// How a single pointed-at instant reads, decided once for everything that points at
// one. The row charts' tooltip and the timeline's playhead readout show the same
// instant at the same moment — a hover writes both — so they cannot be allowed to
// print it two different ways.
//
// Always the whole instant, weekday and date included, however narrow the window it was
// pointed at in. This used to be span-dependent — a crop inside one day printed a bare
// 22:15, on the argument that no two points in it could share a clock time — but that
// answers the wrong question. Nothing on the chart says which day is on screen: the
// x-axis is clock time by design (see LevelTrace), and a crop of one evening is the
// ordinary case, so the rule left the tooltip mute about the day almost always. It costs
// eight characters on a line that has them.
//
// Live keeps its seconds, that window being minutes wide, and takes the date on the same
// terms as everything else: one shape for the readout rather than one per mode.
//
// In milliseconds, unlike the field helpers above: that is the unit an instant travels
// this page in, and uPlot's seconds are a local fact of the chart. Converting here rather
// than at each caller is what lets the readout share this at all.
export const instantLabel =
  (live: boolean): ((ms: number) => string) =>
  (ms) => {
    const d = zonedDate(ms / 1000);
    const clock = live
      ? `${hourMinuteOf(d)}:${pad2(d.getSeconds())}`
      : hourMinuteOf(d);
    return `${weekdayOf(d)} ${dayOf(d)} ${clock}`;
  };

// Vertical-grid steps in seconds, smallest first, for the row charts' time axis.
// A fixed ladder rather than a fixed line count, so the grid reads as clock time:
// half-minute lines on a five-minute live window, quarter hours on an afternoon.
//
// It continues past an hour because a project window is a festival, i.e. days —
// capped at 1 h, a four-day range would draw a picket fence of ~100 lines. Nearly every
// step divides the one above it, so widening the window mostly thins the grid out
// instead of moving every line to a new offset — 2 h → 3 h is the exception, and the
// one place a widening chart redraws its lines somewhere new.
const TIME_GRID_STEPS_S = [
  30,
  60,
  5 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  2 * 60 * 60,
  3 * 60 * 60,
  6 * 60 * 60,
  12 * 60 * 60,
  24 * 60 * 60,
];

// The step for a `spanSeconds` window drawn `widthPx` wide: the smallest one that
// leaves at least `minSpacePx` between lines. A window wider than the ladder covers
// (a project can be given any dates at all) gets the exact step that fits — off the
// clock grid, but only in a case no ladder would have covered anyway.
//
// Never zero, and never so fine that the lines merge: uPlot picks the increment for
// an axis itself, and when nothing clears its minimum spacing it settles on zero,
// whose split generator loops without ever advancing. Deciding it here instead
// makes that unreachable — and testable.
//
// The same arithmetic for either axis, which is why it is one function: a chart's dB grid
// answers to its height exactly as its time grid answers to its width (see LevelTrace),
// and both want the finest line spacing that is still legible rather than a fixed count.
export function gridStep(
  steps: readonly number[],
  span: number,
  dimPx: number,
  minSpacePx: number,
): number {
  const needed = (Math.max(0, span) * minSpacePx) / Math.max(1, dimPx);
  return steps.find((step) => step >= needed) ?? needed;
}

export function timeGridStepS(
  spanSeconds: number,
  widthPx: number,
  minSpacePx: number,
): number {
  return gridStep(TIME_GRID_STEPS_S, spanSeconds, widthPx, minSpacePx);
}

// A gap wherever consecutive *non-null* values of one series are further apart than
// `gapThresholdX`, with uPlot's null-derived gaps discarded — uPlot otherwise draws a
// continuous line across missing data.
//
// That discarding is the point. Where several devices share one chart, their x
// columns are the union of their sample times, so each series is null at every
// instant that belonged to another device — nulls that say nothing about whether
// *this* monitor was reporting. uPlot strokes straight through a null and renders
// gaps by clipping the list this refiner returns, so returning only the intervals
// this series was actually silent for draws each line whole and still breaks it
// where the monitor went quiet.
//
// For one device it is the rule above by another route: its column has a value at
// every x, so consecutive non-nulls are consecutive samples.
export const makeSampleGapsRefiner =
  (gapThresholdX: number): uPlot.Series.GapsRefiner =>
  (u, sIdx, i0, i1) => {
    const xs = u.data[0];
    const ys = u.data[sIdx];
    const out: [number, number][] = [];
    let prev: number | null = null;
    for (let i = i0; i <= i1; i++) {
      if (ys[i] == null) continue;
      const x = xs[i] as number;
      if (prev != null && x - prev > gapThresholdX) {
        out.push([
          Math.round(u.valToPos(prev, 'x', true)),
          Math.round(u.valToPos(x, 'x', true)),
        ]);
      }
      prev = x;
    }
    return out;
  };

// A ref that always holds the latest value, for reading current props inside a
// long-lived plot closure without making them effect dependencies — a chart
// must not be torn down and rebuilt because a callback got a new identity.
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
