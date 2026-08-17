import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, HStack, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {subscribeToClock, useNoiseBuffers} from './context';
import {GAP_THRESHOLD_S, STORED_GAP_THRESHOLD_S, WINDOW_S} from './noise';
import {
  alignedBuffers,
  alignedSeries,
  bufferColumn,
  seriesByKey,
  traceColumn,
  traceData,
  type SeriesKey,
} from './series';
import {
  formatDb,
  metricTag,
  seriesLabel,
  weightingUnit,
  type PickedSeries,
} from './level';
import {type SeriesTraces} from './projectLogs';
import {themeHex} from '../../theme-noise';
import {limitSegments, type LimitLine} from './limitLines';
import {clampTo} from './timeframe';
import {
  axisBase,
  CHART_PADDING,
  cursorAnchor,
  dbAxis,
  dbLevelAxis,
  fmtHourMinute,
  instantLabel,
  labelStride,
  makeSampleGapsRefiner,
  MIN_PLOT_HEIGHT,
  plotHeight,
  timeGridStepS,
  useLatest,
  X_AXIS_H,
  zonedDate,
} from './chartUtils';
import {ChartTooltip} from './ChartTooltip';
import {SelectionMenu} from './SelectionMenu';
import {attachTouchGestures} from './uplotTouchGestures';
import {usePlayheadEffect, type DeviceWindows} from './projectView';

// A level trace: a line per monitor per picked window, a sparse label up each side, and a
// tooltip for what the lines are. The section's only time chart — a device page once had
// a bigger one of its own, with nine toggleable lines and a legend and a zoom, and the
// same monitor read differently depending on which page you opened it from. This one is
// sized by whatever box it is given (down to MIN_PLOT_HEIGHT), which is what let the two
// become one: a card's row and a page's panel are the same chart at two heights.
//
// A chart of the place and not of its monitors, which is the whole reason the lines are
// windowed: a monitor's history covers the event wherever it stood, so drawn whole under
// one location it would plot every other stage it visited. Clipped, consecutive monitors
// read as one continuous trace of the location — and the chart is drawn even where there
// is nothing to plot, because an empty pair of axes says "nothing was measured here" and
// a missing chart says nothing at all.
//
// Which quantities it plots is the header's choice: every picked series is a column — of
// the stored payload when not live, of the rolling buffer when live — and neither side
// computes anything the device did not report. Usually one, because usually one is the
// question; several when the question is a comparison, which is the reason the pick is a
// set at all.
//
// Colour attributes the quantity and the name attributes the monitor, which is the whole
// legend this chart has:
//
//   across kinds     — each is its own shade off the series table (yellow through red, see
//                      theme-noise), the same shade the number in it is printed in, so
//                      three lines are told apart without a key.
//   across weightings — nothing: a kind's dB(A) and dB(C) are one measurement under a
//                      different filter and share a colour by design, so LAeq,5m and
//                      LCeq,5m drawn together are two lines of one shade. They are nested
//                      the way the windows are (C ≥ A, the weighting being what is
//                      subtracted), so which is which is legible from the picture; what
//                      names them is the card's readouts and this one's tooltip, which
//                      prints the series in full for exactly this reason.
//   within one       — every monitor of a series draws in that one colour: two monitors at
//                      a location are two readings of the same place, and the useful thing
//                      to see is the envelope they make. Which of them is which is what the
//                      header's names and this one's tooltip are for.
//
// So there is still no legend of its own: at row height it would cost more of the trace
// than it explained, and on the device page the tile row above the chart already is one.
//
// The filled area under the trace belongs to a *single* series (see the series list): they
// are nested — Peak ≥ Fmax ≥ Leq,1m ≳ Leq,5m ≳ Leq,30m, and dB(C) ≥ dB(A) throughout — so
// an area under any one of several paints over the quieter lines, and two at 15 % stack
// into a shade that reads as data. One series keeps the fill it always had; several are
// lines only.
//
// Two sources, one shape, chosen by `live`:
//   live off — the devices' whole stored history at one point per minute, already on a
//              shared x (see alignedSeries). uPlot clips it to the x-scale and reduces
//              it to min/max per pixel column itself, so cropping the timeline is a
//              redraw here and no work at all upstream.
//   live on  — the layout's rolling MQTT buffers, merged onto one x and re-projected
//              once a second over their last WINDOW_S, so a row moves while you watch.

// What each monitor read at the sample the cursor is on, in each series drawn — the body of
// the tooltip, and the only place this chart names either its monitors or its series in
// full. Colour says which *kind* a line is (see above) and nothing else: every monitor of a
// series shares it, and so do a kind's two weightings, so a hover is how both are asked.
//
// Monitor-outer, series-inner, so a monitor's readings arrive as a run: the tooltip is read
// as "what is this one saying", not as "what is the 5-minute Leq everywhere".
//
// uPlot snaps `idx` to the nearest sample however far away it is, so a hover over a gap
// would otherwise report the reading on the far side of it. Past the same threshold that
// breaks the line, there is nothing under the pointer and the tooltip says only when.
//
// A monitor with no value at that sample is left out rather than printed as a dash: it
// was either silent or standing somewhere else, and the masked line already shows which
// by not being there.
function readingsAt(
  u: uPlot,
  lines: DeviceWindows[],
  picked: readonly SeriesKey[],
  envelope: boolean,
  gapThresholdX: number,
): Array<{deviceId: string; series: SeriesKey; db: number}> {
  const idx = u.cursor.idx;
  if (idx == null) return [];
  const dataX = u.data[0]![idx] as number | undefined;
  const cursorX = u.posToVal(u.cursor.left ?? -1, 'x');
  if (dataX == null || Math.abs(cursorX - dataX) > gapThresholdX) return [];
  const out: Array<{deviceId: string; series: SeriesKey; db: number}> = [];
  for (const [d, {deviceId}] of lines.entries()) {
    for (const [s, series] of picked.entries()) {
      // Never counted out here: where a column sits is the projection's layout, and a
      // reader that worked it out for itself would go on printing plausible levels
      // attributed to the wrong monitor the day the layout moved.
      const db = u.data[traceColumn(s, d, lines.length, envelope)]?.[idx];
      if (db != null) out.push({deviceId, series, db});
    }
  }
  return out;
}

// Whether a keystroke is somebody writing rather than reaching for a shortcut. The
// dialogs on this page are full of fields, and one of them may well be open over a
// row the pointer is still resting on.
const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// The line's own colour at 15 %, so the trace reads as an area without the line getting
// lost in it. An 8-digit hex rather than `color-mix()`, which a canvas `fillStyle` on an
// older phone may not parse: the suffix is only legal because every series token resolves
// to a 6-digit hex, which theme-noise.test.ts asserts for all of them.
const fill = (stroke: string) => `${stroke}26`;

// The closest two time labels may sit, which decides how many grid lines go
// unlabelled between them. Sized for "22:15" at the axis font with room to breathe —
// the axis prints nothing wider, whatever the crop.
const X_LABEL_SPACE = 48;

// How far the pointer must travel before a press counts as a selection rather than a
// click. A few pixels: the gesture is a deliberate sweep across a peak, and anything
// shorter than this on a row-height chart is a hand not quite still.
const DRAG_MIN_PX = 6;

// Minimum pixels between vertical lines, which is what picks the step off
// timeGridStepS' ladder. Generous, because a row is only a few hundred pixels wide
// and the grid is orientation, not a scale to measure against.
const X_GRID_SPACE = 56;

// A limit's dash, on and off. Short enough to read as a rule at row height rather than as
// a row of ticks, and the pattern is what carries "this is not a measurement" where the
// colour cannot — colour is never the only cue in this section.
const LIMIT_DASH = [4, 3];

// The rule's own width, and the halo's, in CSS pixels. Odd widths both, so the two stay
// concentric about the same row of pixels.
//
// A hard casing alone was tried at 3 against 1 and is not enough: a pixel of ground either
// side of a dash reads as anti-aliasing rather than as separation, and the shade that ties a
// rule to its trace still buries it in one. The blur is what makes it a halo — the ground
// fades out over a few pixels, so the eye gets a gap around the dash whatever is behind it,
// which is the thing a fixed one-pixel outline cannot promise against a fill of similar
// value.
const LIMIT_WIDTH_PX = 1;
const LIMIT_HALO_PX = 3;
const LIMIT_HALO_BLUR_PX = 4;

/**
 * The permitted levels, over the traces they are permitted for.
 *
 * Each in the shade of the series it is written against and dashed where that series' own
 * line is solid, which between them are the two things a rule has to say: which of the lines
 * on this chart it bounds, and that it is not one of them. Only the limits whose series is
 * picked are drawn at all (see limitSegments) — so the header's menu brings a rule and the
 * line it belongs to into view together.
 *
 * Over a halo in the ground's own colour, because the shade that ties a rule to its trace is
 * also what buries it in one: a yellow dash over a yellow envelope is a rule you have to hunt
 * for, and the fill under it is exactly where a limit matters most. The ground fading out
 * around each dash separates the two without giving the rule a hue of its own to be mistaken
 * for a sixth measurement — see chart.ground.
 *
 * The line alone, with no figure lettered on it. What a rule is for is seeing at a glance
 * whether the trace is under it, and for that the height *is* the reading — the dB grid
 * beside it already places the line on the axis, and a number repeated on every rule on
 * every card was type in the middle of the plot competing with the levels it was describing.
 * The figure is edited, and read back, in the dialog that sets it.
 *
 * A `draw` hook, where the playhead above is deliberately a DOM line — and the difference
 * is worth stating, because the two look like the same problem. That comment is about cost
 * per pointer frame: the playhead moves with the hand, and a full redraw of every card's
 * plot to move one line is what it buys its way out of. A limit moves only when the x scale
 * or the plot's size does, which is when uPlot redraws anyway, so the hook here is free —
 * and it draws the thing a `<div>` would make awkward: a rule bounded at both ends in x.
 *
 * Device pixels throughout, which is the whole of what makes canvas work here and the one
 * thing easy to get silently wrong. Positions come from valToPos' third argument, the `true`
 * makeSampleGapsRefiner also passes; the stroke and the dash are written in CSS pixels and
 * scaled by `uPlot.pxRatio`, exactly as uPlot scales its own stroke widths. Skip that and on
 * a retina screen the rule comes out a hairline, which looks like a styling choice rather
 * than a bug.
 */
function drawLimits(
  u: uPlot,
  limits: readonly LimitLine[],
  picked: PickedSeries,
): void {
  if (limits.length === 0) return;
  const {min, max} = u.scales.x;
  if (min == null || max == null) return;
  const segments = limitSegments(limits, picked, min, max);
  if (segments.length === 0) return;

  // Read per draw rather than closed over: uPlot itself re-reads it on a dppxchange, which
  // is what dragging a window between two displays fires.
  const ratio = uPlot.pxRatio;
  const ctx = u.ctx;
  ctx.save();
  // The plotting area and nothing else: a rule is drawn in the scale's own coordinates,
  // and the axes' gutters are not part of it.
  ctx.beginPath();
  ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
  ctx.clip();

  ctx.setLineDash(LIMIT_DASH.map((d) => d * ratio));

  const [floor, ceiling] = dbAxis.range;
  // Positions once, since both passes below stroke the same geometry.
  const rules = segments.map(({series, decibels, from, to}) => ({
    // The shade of the line it bounds, which is what ties the two together where several
    // series are picked and each has a limit of its own: a rule and its trace are one
    // statement about one quantity. What keeps it from reading as a sixth measurement is
    // the dash — the form, not the hue. Two weightings of a quantity share a shade by
    // design (see the series table), and so do their limits.
    stroke: themeHex(seriesByKey(series).color),
    // Clamped to the axis, which is fixed at 30–110 (see dbAxis): a peak limit written at
    // 120 has to be drawn somewhere, and hard against the top of the plot is the honest
    // place. Dropping the line instead would be the worse answer — a limit nobody can see
    // is one nobody knows is set — and a rule pinned to the top edge reads as "above
    // anything this chart can show", which is what it is.
    //
    // Half the stroke down from a whole pixel, so it lands on a row of them rather than
    // straddling two — the same reason the playhead carries a negative half-pixel margin.
    y: Math.round(u.valToPos(clampTo(decibels, floor, ceiling), 'y', true)) + ratio / 2, // prettier-ignore
    x0: Math.round(u.valToPos(from, 'x', true)),
    x1: Math.round(u.valToPos(to, 'x', true)),
  }));

  const trace = ({y, x0, x1}: (typeof rules)[number]) => {
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
  };

  // Every halo, then every rule — two passes over the list rather than a halo and its rule
  // per segment. Limits are allowed to overlap (see the schema), and the axis is fixed at
  // 80 dB over a chart that may be 160 px tall, so two decibels can be four pixels: well
  // inside the blur. Interleaved, the second rule's halo would land over the first one's
  // line, and the thing that made one legible would be what dimmed the other.
  //
  // The halo is a stroke of the ground *plus* its own shadow of the same colour, which is
  // what spreads it: canvas paints the shadow around the stroke, so three pixels of solid
  // ground fade out over four more. Dashed along with the rule rather than solid under it, so
  // it thickens each dash instead of filling the gaps between them — the trace stays
  // readable through the rule, which is the whole point of dashing it.
  //
  // One path for all of them and one stroke, because `shadowBlur` is the expensive call on a
  // canvas — each stroke is rendered to a scratch surface and gaussian-blurred, and Skia has
  // no fast path for a blurred *dashed* stroke. A timeline drag commits a crop per animation
  // frame to every card near the viewport (see applyCrop), so per-rule strokes made that a
  // shadow layer per limit per card per frame. Batched it is one, for the same pixels: the
  // dash phase restarts per subpath, so the dashes are unchanged, and overlapping halos now
  // composite in a single layer instead of darkening each other.
  const ground = themeHex('chart.ground');
  ctx.lineWidth = LIMIT_HALO_PX * ratio;
  ctx.strokeStyle = ground;
  ctx.shadowColor = ground;
  ctx.shadowBlur = LIMIT_HALO_BLUR_PX * ratio;
  ctx.beginPath();
  rules.forEach(trace);
  ctx.stroke();

  // The rules themselves cannot be batched the same way — each is stroked in its own series'
  // shade — but they carry no shadow, so they are ordinary line drawing. No shadow on
  // purpose: the halo is already under them, and a coloured line casting a dark blur of its
  // own would read as the line being out of focus.
  ctx.shadowBlur = 0;
  ctx.lineWidth = LIMIT_WIDTH_PX * ratio;
  for (const rule of rules) {
    ctx.strokeStyle = rule.stroke;
    ctx.beginPath();
    trace(rule);
    ctx.stroke();
  }

  ctx.restore();
}

// The playhead, drawn as a DOM line over the canvas rather than in it. A `draw` hook
// would mean a full redraw of every row's plot per pointer frame for a line that
// moves independently of the data; this is one style write. Inside u.over, so it is
// positioned in the plotting area's own coordinates (what valToPos returns) and
// clipped by it — no arithmetic against the container, and no line hanging off the
// end of a chart whose scale has moved past the playhead.
const PLAYHEAD_CLASS = 'noise-row-playhead';

// Hoisted, and not an inline object on the Box: Emotion re-serializes a fresh style
// object every time it sees one, and there is one of these per card on the list. A module
// constant is hashed once for the whole session.
const CHART_CSS = {
  // uPlot's own rubber band, which its stylesheet paints in 7 % black — invisible on
  // this chart. The playhead's colour at the same 15 % the trace fills its area with, so
  // the drag region reads as one of this chart's own marks rather than as the library's.
  //
  // It matters more than it did when the sweep committed a crop on mouse up and the band
  // was gone the same frame: it now stays up for as long as the selection menu is open,
  // as the only thing saying which range that menu is about.
  '& .u-select': {
    background: 'chart.playhead/15',
  },
  [`& .${PLAYHEAD_CLASS}`]: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // A hairline: at row height the trace is only ~160 px of chart, and anything
    // thicker reads as a band over the samples it is meant to point at.
    width: '1px',
    // Centred on its instant rather than starting at it, so it marks the sample the
    // pointer is on rather than the pixel after it. In the margin rather than the
    // transform, which positionPlayhead writes and should hold nothing else.
    marginLeft: '-0.5px',
    background: 'chart.playhead',
    // The cursor underneath it has to keep receiving the pointer, or the line would
    // stall the moment it caught up with what's moving it.
    pointerEvents: 'none',
  },
} as const;

// The props, as one shape per mode rather than a flag and five optionals: a cropped chart
// has a timeframe, a strip to move it in, a playhead to move and a stored trace to draw,
// and a live one has none of those. Split like this the compiler is what enforces the
// pairing — before, a caller could ask for a crop and pass no range, and the chart would
// scale itself to 1970 rather than fail to build.
type LevelTraceProps = {
  // Every monitor this location has ever had, with the windows it had them for. One
  // line each, clipped to those windows; one line is the ordinary case, and none — a
  // location nothing has stood at yet — draws an empty chart rather than nothing.
  lines: DeviceWindows[];
  // Which series the page is showing. `traces` below was already resolved for them; this is what
  // picks the matching columns out of the live buffer, and what colours each line — the
  // same shade the number for that series is printed in.
  //
  // Every entry names a row of the table by construction (see SeriesKey), so nothing is
  // filtered here: a chart that dropped a column its series list still had would draw a
  // monitor's readings under another monitor's name.
  picked: PickedSeries;
  // What this place is permitted, as rules over the trace. In the common part of the shape
  // below rather than in either arm: a limit is a fact about the location and is drawn the
  // same way whether the chart is showing a crop or the last few minutes.
  //
  // Optional because one caller genuinely has none to give — a monitor standing nowhere has
  // no limits, which is a place with no permit rather than a permit of none.
  limits?: readonly LimitLine[];
  // How much height to give the time axis, for the one caller that cannot take the
  // default. A chart's bottom gutter comes out of its plot area, so two charts side by
  // side draw their grids at different heights unless they reserve the same — and on the
  // device page this stands beside the band spectrum, whose 31 frequency labels have to
  // be turned −45° to fit and so want twice the room. LiveView hands both the same
  // number. Everywhere else the flat HH:MM labels here want no more than X_AXIS_H, and a
  // location card's row has none to spare.
  xAxisSize?: number;
} & (
  | {
      // The rolling window, on the clock: no crop to show, and so nothing to point at or
      // to move. What a device page always is, and a location card is while the project
      // page is live.
      live: true;
      range?: never;
      bounds?: never;
      onScrub?: never;
      onCrop?: never;
      traces?: never;
    }
  | {
      live: false;
      // The crop in epoch ms: this chart's x-range, and the only thing a timeline drag
      // changes here.
      range: {start: number; end: number};
      // How far a touch gesture may reach, in epoch ms: the whole of the project that can
      // be looked at, of which `range` is the part currently on screen. Wider than the
      // crop on purpose — that is what a pinch widens into and what a two-finger drag
      // travels along, and clamping either to the chart's own extent would leave them
      // nothing to do.
      bounds: {start: number; end: number};
      // Where the pointer is, in epoch ms, once per animation frame while it's over the
      // plot (uPlot batches its own cursor updates to a frame) — and null when it is no
      // longer over it, which is as much a statement about the page's instant as a
      // position is: the playhead is where a pointer is pointing, and nothing is.
      onScrub: (at: number | null) => void;
      // Crops the page's timeframe to what this trace was pointed at, in epoch ms. Two
      // gestures, one answer, because they differ only in how much of the crop they name:
      //
      //   `i` / `o` — one end, while the pointer is over this plot. The in/out keys of
      //               every editing timeline, and the fastest way to bound the crop on the
      //               peak you are looking at rather than dragging two thumbs towards it.
      //               Bound to the hover, so the keys belong to the trace and not the page.
      //   a drag    — both ends, swept across the trace (uPlot's own rubber band). The one
      //               gesture that does not arrive here on its own: a sweep names a range
      //               and opens a menu over it, and this is what the menu's zoom calls.
      //               See SelectionMenu.
      //   two fingers — both ends, pinched and slid. Direct manipulation, so it crops as
      //               it moves: there is no cursor left standing for a menu to open at,
      //               and a chart that stopped following the fingers to ask would be a
      //               gesture with a dialog in the middle of it.
      //
      // An omitted end keeps the crop's own.
      onCrop: (crop: {start?: number; end?: number}) => void;
      // Every device's whole stored trace, at one point per minute, per picked series — the
      // page's own record, passed through rather than picked apart here. Absent while it
      // loads, and missing an entry for a device that measured nothing in the project.
      //
      // Named for what it holds and not `series`, which since the pick carries its own
      // weighting means a row of the table: `picked` above names the series, this is the
      // data for them.
      traces?: SeriesTraces;
    }
);

export function LevelTrace({
  lines,
  live,
  picked,
  limits,
  range,
  bounds,
  onScrub,
  onCrop,
  traces,
  xAxisSize = X_AXIS_H,
}: LevelTraceProps) {
  // The buffers alone: a chart has nothing to say about a record arriving — the
  // canvas is redrawn by its own tick below — so it must not subscribe to them.
  const deviceData = useNoiseBuffers();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Read through refs by the plot's long-lived closures, so a mutating live buffer or a
  // new range never leaves them stale and never rebuilds the plot. `live` is deliberately
  // not one of them: the gap threshold below is derived from it and is baked into the
  // series at construction, so switching source rebuilds the plot either way.
  const tracesRef = useLatest(traces);
  const rangeRef = useLatest(range);
  // Through a ref for the same reason as the range, and read only from inside a gesture:
  // the window's right edge follows the clock on a running festival, so the object is new
  // every minute and a dependency on it would rebuild the plot for a number no gesture
  // was using at the time.
  const boundsRef = useLatest(bounds);
  // And the limits, which is what keeps them out of the plot-build dependencies below: a
  // limit saved in the dialog must repaint the rule, not tear the chart down and build a
  // new one under the pointer. The effect further down asks for that repaint.
  const limitsRef = useLatest(limits);
  // The set they are drawn against, through a ref for the same reason — a limit is drawn
  // only where its series is (see limitSegments), so the draw hook needs the current pick
  // and not the one the plot was built on. Read off a ref rather than the closure, which is
  // what this used to be: that was fresh only transitively, because `strokes` is derived
  // from the pick and is in the plot's dependencies — a hidden dependency of the limits'
  // correctness on an unrelated memo.
  const pickedRef = useLatest(picked);
  // Whether this chart has a crop to move, which is everything uPlot has to be built
  // differently for: its own drag-select, and the touch gestures. Both were their own
  // derived flag (`selectable`, `touchable`) back when a caller could withhold either
  // callback on its own; the shape above no longer allows it.
  const cropped = !live;
  // The lines go the same way, and a digest of them into a key: the array is new on
  // every render of the card above, so an effect that depended on it directly would
  // tear the plot down for a card that had merely re-rendered. The windows are in the
  // key as well as the names — retiming an assignment changes what is plotted without
  // changing who is plotted.
  //
  // Memoized because this component re-renders on every frame of a hover — `tip` is
  // state — and `lines` is untouched by that, so without it a walk of every window of
  // every monitor would run sixty times a second to produce the same string.
  const linesRef = useLatest(lines);
  const linesKey = useMemo(
    () =>
      lines
        .map(
          (l) => `${l.deviceId}:${l.windows.map((w) => `${w.start}-${w.end}`)}`,
        )
        .join(' '),
    [lines],
  );
  // The pick the same way, and for the same reason: this component re-renders on every
  // frame of a hover, and everything below derived from the set — the colours, the buffer
  // columns, the effect that builds the plot — would otherwise be recomputed or torn down
  // for a set that had not changed.
  const pickedKey = picked.join(' ');
  // How many monitors the plot has a line for, per series. At least one, so a location with
  // no monitor yet still has a series to be empty in rather than an axis pair uPlot would
  // reject.
  const lineCount = Math.max(1, lines.length);
  // Whether the filled area is a series of its own — which it is for exactly one shape:
  // one series, several monitors, where the area belongs under the loudest of them rather
  // than under each (see the series list). One flag rather than a monitor count and a
  // series count consulted separately, because the projection, that list and the tooltip
  // all have to agree about whether the column is there at all.
  const envelope = lines.length > 1 && picked.length === 1;
  // Through a ref like the rest: it must not tear the plot down to swap which buffer
  // columns are plotted. The live projection reruns every second anyway, and a new
  // `series` lands with it when not live. (Ticking a box does rebuild the plot — see the
  // strokes below — but this still has to be right on the frame it is rebuilt on.)
  const colsRef = useLatest(
    useMemo(() => picked.map(bufferColumn), [pickedKey]),
  );
  // Each line's colour from the shared table, so the row and the device page draw the same
  // line in the same shade. uPlot bakes a series' stroke in at construction, so unlike the
  // columns these do rebuild the plot; they change only when someone ticks a box, and at
  // this size a rebuild is cheap. (A kind's two weightings resolve to the same shade — one
  // measurement under a different filter, and one colour; the tooltip below is what tells
  // them apart.)
  //
  // Two forms of the same colours: the tokens for the tooltip, which is Chakra and wants
  // the name, and the hexes for the canvas, which cannot take one. Memoized so the array
  // identity is stable, the plot-building effect depending on it directly.
  const tokens = useMemo(
    () => picked.map((key) => seriesByKey(key).color),
    [pickedKey],
  );
  const strokes = useMemo(() => tokens.map(themeHex), [tokens]);
  // What the tooltip's numbers are in. With one line there is one weighting and one window
  // to state, so the number carries both — `87.5 dB(A) 5m`, spelled the way the card's
  // header spells it. With several the row already names the series in full beside it, and
  // a name says its own unit: a figure under `LCeq,5m` is dB by definition, and repeating
  // the weighting after the number would be the second place a line says which it is — and
  // the wrong place, the lines no longer sharing one.
  const only = picked.length === 1 ? seriesByKey(picked[0]) : null;
  const unitLabel = only
    ? `${weightingUnit(only.weighting)} ${metricTag(only.kind, live)}`
    : 'dB';
  const onScrubRef = useLatest(onScrub);
  // Where the line stands: the instant the page is looking at, written by the
  // subscription below rather than taken as a prop. The playhead is page state that moves
  // on every frame of a hover over any row on the page, so a prop would mean re-rendering
  // every chart at once to hand each of them a number it only writes into a ref — see
  // usePlayheadEffect.
  //
  // While live it is this chart's own hover instead, because there is no page playhead
  // then (see the setCursor hook). Same ref either way: it is the line's position, and the
  // line is one line.
  const currentRef = useRef<number | null>(null);

  // The hovered instant and what every monitor read at it, anchored in container pixels.
  // The only readout there is: the numbers above a chart are what is arriving now, and
  // this is what a particular moment of the trace was.
  //
  // The readings are here rather than only in the card's header because the header prints
  // one number per series for the whole location (the loudest monitor's), while this chart
  // may be drawing a line per monitor per series: what the tooltip answers is which line is
  // which, which is also what the chart has no legend for.
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    // How far along the card that pixel sits, which is what keeps the readout inside it
    // (see ChartTooltip). Straight off cursorAnchor with the two coordinates.
    fraction: number;
    label: string;
    readings: Array<{deviceId: string; series: SeriesKey; db: number}>;
  } | null>(null);

  // The range a sweep has named and not yet done anything with: the crop it would make,
  // in epoch ms, and the pixel the pointer came up on for the menu to open at. Null
  // whenever there is no menu — the two are the same fact, and the menu is mounted from
  // this rather than from an `open` flag beside it.
  const [pending, setPending] = useState<{
    start: number;
    end: number;
    left: number;
    top: number;
  } | null>(null);

  // The instant the pointer is on, for the keys below to read. A ref and not part of
  // `tip`: it is rewritten on every frame of a hover, and nothing renders from it.
  const hoverAtRef = useRef<number | null>(null);
  const onCropRef = useLatest(onCrop);
  // Read by the cursor hook, which is a closure the plot keeps for its lifetime and which
  // must not be rebuilt for a menu opening. All it wants to know is whether one is.
  const pendingRef = useLatest(pending);

  // How the pointed-at instant reads — weekday, date and clock, whatever the crop, plus
  // seconds while live. Shared with the timeline's readout, which labels the same instant
  // a hover here puts under the playhead, and which is why the rule lives in instantLabel
  // rather than here.
  const formatRef = useLatest(instantLabel(live));

  const playheadRef = useRef<HTMLDivElement | null>(null);

  // Where the playhead stands on this chart, or out of sight when it stands outside
  // the crop this one is showing (or when there is no playhead at all).
  //
  // Called two ways, hence the default: with an instant — by the page's playhead
  // subscription below, or by this chart's own hover while live, when there is no such
  // subscription to follow; and with none, by a resize or a rescale, which move the pixel
  // the same instant falls on. Imperative and ref-driven either way, so it can be
  // called from the plot's own callbacks.
  const positionPlayhead = useCallback(
    (next: number | null = currentRef.current) => {
      currentRef.current = next;
      const line = playheadRef.current;
      const plot = plotRef.current;
      if (!line) return;
      const at = currentRef.current;
      if (!plot || at == null) {
        line.style.display = 'none';
        return;
      }
      const x = at / 1000;
      const {min, max} = plot.scales.x;
      if (min == null || max == null || x < min || x > max) {
        line.style.display = 'none';
        return;
      }
      line.style.display = '';
      // transform rather than `left`: this runs on every frame of a hover, on every
      // chart at once, and a transform stays off the layout path.
      line.style.transform = `translateX(${plot.valToPos(x, 'x')}px)`;
    },
    [],
  );

  // Stable by construction — positionPlayhead closes over nothing but refs — which is
  // what keeps the subscription from being torn down and re-established as the page
  // scrubs, and this component from rendering for it at all.
  usePlayheadEffect(positionPlayhead);

  // How far apart two of a monitor's readings may be before the line between them is
  // a lie rather than a line — a few seconds of a 1 Hz stream, and a minute and a half
  // of a per-minute one, where a single missing minute is already a 120 s step. Also
  // how long one counts as still standing at its last reading, for the envelope.
  const gapThresholdX = live ? GAP_THRESHOLD_S : STORED_GAP_THRESHOLD_S;

  const project = useCallback((): uPlot.AlignedData => {
    const current = linesRef.current;
    // A device with no records yet has no buffer at all (only ingest creates one),
    // and one that measured nothing in the project has no stored trace; either way
    // the aligners pad it to the shared x rather than dropping a column uPlot is
    // expecting. Both take every window in one call, so the x column is one array by
    // construction rather than several that happen to agree.
    const aligned = live
      ? alignedBuffers(
          current.map((l) => deviceData.current[l.deviceId]),
          colsRef.current,
        )
      : alignedSeries(
          picked.map((key) =>
            current.map((l) => tracesRef.current?.[key]?.[l.deviceId]),
          ),
        );
    // The clipping — each monitor drawing only where it stood here, which is what makes
    // this a chart of the location — and the envelope where there is one, both in
    // traceData: the column layout is the series table's business, and a chart that laid it
    // out itself would be the second place that decided it. A location nothing has ever
    // stood at lands here too, and comes back as empty columns over drawn axes rather than
    // as a card with a gap where a chart should be.
    return traceData(
      aligned,
      current.map((l) => l.windows),
      {
        metricCount: picked.length,
        envelope,
        holdX: gapThresholdX,
      },
    ) as uPlot.AlignedData;
    // Keyed on digests rather than on the arrays: the same monitors over the same windows
    // in the same set of quantities are the same projection, and new arrays of them every
    // render are not a new plot.
  }, [
    linesKey,
    pickedKey,
    linesRef,
    deviceData,
    live,
    envelope,
    tracesRef,
    colsRef,
    gapThresholdX,
  ]);

  // Epoch seconds, uPlot's x unit. Live is a window on the clock rather than on
  // the data, so it slides even while nothing arrives — which is what makes a
  // silent device visibly trail off instead of holding its last value.
  const xRange = useCallback((): [number, number] => {
    if (live) {
      const now = Date.now() / 1000;
      return [now - WINDOW_S, now];
    }
    // Only reached when not live, where the caller always has a crop — the whole point
    // of the live branch above is that there is none.
    const {start = 0, end = 0} = rangeRef.current ?? {};
    return [start / 1000, end / 1000];
  }, [live, rangeRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // One refiner for every line: it closes over nothing but the threshold, and uPlot
    // only ever calls it.
    const gaps = makeSampleGapsRefiner(gapThresholdX);

    // Both axes carry a grid and a thin row of labels — enough to read a level and a
    // time off the trace without going to the timeline for one and the row's numbers
    // for the other. Off chartUtils' axisBase, which is also what the band spectrum
    // beside this one on the device page letters its axes with.
    const plot = new uPlot(
      {
        width: container.clientWidth || 300,
        height: plotHeight(container, MIN_PLOT_HEIGHT),
        legend: {show: false},
        // The line you see under the pointer is the playhead — drawn by every row at
        // once when there is a page instant to share, and by this row alone while live —
        // so uPlot's own guides stay off and this cursor exists only to report where the
        // pointer is. Same end as uPlot's sync-cursor demo, reached through the page's
        // selection rather than a sync key: the timeline, the dB readouts and the map
        // pins have to follow the pointer too, and none of them is a plot.
        cursor: {
          x: false,
          y: false,
          points: {show: false},
          // uPlot's own drag-select, with its zoom switched off: it draws the band and
          // reports it, and the page's crop is what the band becomes (see setSelect).
          // Letting it setScale would zoom this one row's x-axis away from the crop
          // every other row, the timeline and every number on the page still shows.
          //
          // The distance threshold is what keeps a click a click: at 0 (the default)
          // every press would end a zero-width selection, and the hover-to-scrub this
          // chart is mostly used for starts with a press often enough.
          drag: {
            x: cropped,
            y: false,
            setScale: false,
            dist: DRAG_MIN_PX,
          },
        },
        hooks: {
          // After the series, so a rule sits over the trace it bounds rather than under
          // the area — a limit the level has already crossed is exactly the one that has
          // to stay visible.
          draw: [
            (u) => drawLimits(u, limitsRef.current ?? [], pickedRef.current),
          ],
          setSelect: [
            (u) => {
              const {left, width} = u.select;
              if (width <= 0) return;
              // The band stays up, and no crop is committed here: the sweep has named a
              // range, and what happens to it is the menu's to say (see SelectionMenu).
              // Out of uPlot's seconds at this boundary, the same as everywhere else.
              //
              // Anchored on the pointer rather than on the band, so the menu opens where
              // the hand already is however far the sweep travelled — u.cursor is still
              // on the pixel the mouse came up on when this runs.
              setPending({
                start: u.posToVal(left, 'x') * 1000,
                end: u.posToVal(left + width, 'x') * 1000,
                ...cursorAnchor(
                  u,
                  container,
                  u.cursor.left ?? left + width,
                  u.cursor.top ?? 0,
                ),
              });
              // The tooltip would otherwise stand on the pixel the menu is about to
              // cover, naming an instant nothing is asking about any more.
              setTip(null);
            },
          ],
          setCursor: [
            (u) => {
              // Frozen while a swept range is waiting on its menu: the pointer is on its
              // way to that menu, and every pixel of the journey would otherwise move the
              // page's playhead and print a tooltip under the thing being read.
              if (pendingRef.current) return;
              const left = u.cursor.left;
              // Negative once the pointer leaves — a lifted finger included, which the
              // touch gestures report by parking the cursor off the plot. The tooltip goes
              // with it, and so does the page's playhead: it marks the instant something is
              // pointing at, and when nothing is there is no instant. The cards' readings
              // and the pins' numbers go quiet with it, which is the resting state of a
              // page nobody is reading.
              if (left == null || left < 0) {
                hoverAtRef.current = null;
                setTip(null);
                // Withheld while live, where the line was never the page's — hence the
                // optional call, and positionPlayhead below for that case.
                onScrubRef.current?.(null);
                // Live's line is the pointer's own, so this chart takes it down itself.
                // Every other line on the page is drawn from the signal the call above
                // just emptied, and goes down with it.
                if (live) positionPlayhead(null);
                return;
              }
              // Out of uPlot's seconds once, here at its edge: everything downstream
              // of this — the ref, the page's playhead, the label — is milliseconds.
              const atMs = u.posToVal(left, 'x') * 1000;
              hoverAtRef.current = atMs;
              onScrubRef.current?.(atMs);
              // Live has no page playhead — nothing is scrubbing a rolling window, so
              // `scrubTo` is withheld and the signal every other chart follows stays
              // empty. Draw the line here instead, so pointing at a live trace marks the
              // sample you are reading in the tooltip rather than leaving the tooltip to
              // say where it came from. This chart's own line and no other card's: what
              // it marks is where *this* pointer is, and there is no page instant for
              // them to share.
              if (live) positionPlayhead(atMs);
              setTip({
                ...cursorAnchor(u, container, left, u.cursor.top ?? 0),
                label: formatRef.current(atMs),
                readings: readingsAt(
                  u,
                  linesRef.current,
                  picked,
                  envelope,
                  gapThresholdX,
                ),
              });
            },
          ],
        },
        axes: [
          // Time lines fall on the full hour, the quarter hour and so on, because
          // uPlot generates time splits off the (zoned) calendar. The step is handed
          // over as the only candidate, so uPlot's own search can't reject it;
          // `space` is nominal for the same reason (timeGridStepS has already
          // enforced X_GRID_SPACE), and non-zero because the split generator
          // divides by it.
          {
            ...axisBase(),
            size: xAxisSize,
            incrs: (_self, _axisIdx, scaleMin, scaleMax, fullDim) => [
              timeGridStepS(scaleMax - scaleMin, fullDim, X_GRID_SPACE),
            ],
            space: 1,
            // Clock time and nothing else, whatever the crop or the mode: the axis is
            // there to place the trace in the evening, and at this width a date on
            // every label buys nothing the timeline above doesn't already say. The
            // tooltip is the precise readout and keeps its seconds and its date.
            //
            // Not every grid line gets a label — the lines are set for orientation,
            // and X_LABEL_SPACE is what keeps the ones that remain apart. Nor does a
            // line whose minute the last label already named: a live window is five
            // minutes wide, so without that the same 22:15 would be printed twice.
            values: (u, splits) => {
              const step = labelStride(u, splits, 'x', X_LABEL_SPACE);
              let last: string | null = null;
              return splits.map((v, i) => {
                if (i % step) return null;
                const label = fmtHourMinute(v);
                if (label === last) return null;
                last = label;
                return label;
              });
            },
          },
          // The dB grid — the same arrangement as the axis above, along the other
          // dimension, and the same one the band spectrum draws: see chartUtils.
          dbLevelAxis(),
        ],
        padding: CHART_PADDING,
        // Grid lines land on festival-local boundaries whatever zone the viewer is
        // in, the same as every other chart in the section.
        tzDate: (ts) => zonedDate(ts),
        scales: {
          x: {time: true, range: () => xRange()},
          y: {range: () => [...dbAxis.range]},
        },
        series: [
          {},
          // The area under the trace is what makes a level readable at row height, and
          // with several monitors it is filled under the loudest of them rather than
          // under each: the lines are all one colour, so two areas would stack into a
          // darker band that looks like it means something. Drawn first, which in
          // uPlot is underneath, and only ever an area — the lines over it are the
          // monitors themselves.
          //
          // Only ever one window's, hence `envelope`: several are nested, so an area under
          // any one of them would paint over the quieter lines (see the head comment).
          ...(envelope
            ? [
                {
                  stroke: 'transparent',
                  fill: fill(strokes[0]!),
                  width: 0,
                  spanGaps: false,
                  gaps,
                  points: {show: false},
                },
              ]
            : []),
          // A block per window, a line per monitor inside it, in the order the projection
          // laid them out — so a window's lines are consecutive and its stroke is fixed for
          // the whole run. Where there is no monitor it is one empty line per window, which
          // is what keeps the axes drawn at a location nothing has stood at yet.
          //
          // The fill goes to the lines themselves only for a lone monitor of a lone window:
          // any other shape either has an envelope above or several windows to keep clear.
          ...strokes.flatMap((stroke) =>
            Array.from({length: lineCount}, () => ({
              stroke,
              fill:
                strokes.length === 1 && !envelope ? fill(stroke) : undefined,
              width: 1.25,
              spanGaps: false,
              gaps,
              points: {show: false},
            })),
          ),
        ],
      },
      project(),
      container,
    );
    plotRef.current = plot;

    const line = document.createElement('div');
    line.className = PLAYHEAD_CLASS;
    plot.over.appendChild(line);
    playheadRef.current = line;
    // A plot nobody is hovering yet. While live that is the whole story — the line is the
    // hover — so it starts empty rather than standing at whatever instant the page was
    // showing before live was switched on. Otherwise it goes straight back to the page's
    // playhead, which is where the rebuilt chart left it.
    if (live) positionPlayhead(null);
    else positionPlayhead();

    // What a finger can do here, which uPlot does nothing about on its own: one finger is
    // the cursor (the tooltip and the page's playhead, the same as a hover), two are the
    // window (a pinch crops, a drag slides it). Installed only where there is a window to
    // move — see `bounds` — so a live chart is left with no touch listeners at all.
    const removeTouch = cropped
      ? attachTouchGestures(plot, {
          // Seconds, uPlot's unit, out of the milliseconds everything else here speaks.
          // The gesture only exists where `bounds` does, so the fallback is unreachable —
          // and it is the crop rather than something invented, so were it ever reached a
          // finger would find the window immovable instead of somewhere unasked for.
          bounds: () => {
            const {start = 0, end = 0} =
              boundsRef.current ?? rangeRef.current ?? {};
            return [start / 1000, end / 1000];
          },
          // The page's crop, once per frame — a pinch on one card moves the timeline, the
          // other cards and every number on the page with the fingers, which is what a
          // drag on the timeline itself does. That commit comes straight back as `range`
          // and lands on this plot through applyCrop, so the setScale here is only about
          // the frame in between: it keeps the chart under the fingers attached to them
          // even while React is catching up. (applyCrop then finds the scale already
          // where it wants it and does nothing.)
          //
          // No special case for a pinch that reaches the whole project: the pair
          // committed *is* the project's window then, which is a crop of everything.
          onRange: (min, max) => {
            onCropRef.current?.({start: min * 1000, end: max * 1000});
            plot.setScale('x', {min, max});
            positionPlayhead();
          },
          // Straight into uPlot's cursor, which fires the setCursor hook above — so a
          // finger reaches the tooltip, the readings and the page's playhead through the
          // one path a mouse does, and there is no second definition of what a hover
          // means. The negative pixel is uPlot's own "pointer has left".
          onScrub: (pos) => plot.setCursor(pos ?? {left: -10, top: -10}, true),
        })
      : undefined;

    // Only the width can change: the row gives the trace a fixed height. A new width
    // is a new pixel for the same instant, so the playhead is replaced with it.
    const ro = new ResizeObserver(() => {
      plot.setSize({
        width: container.clientWidth,
        height: plotHeight(container, MIN_PLOT_HEIGHT),
      });
      positionPlayhead();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      // Before the plot goes: the listeners are on a node uPlot is about to take away.
      removeTouch?.();
      plot.destroy();
      plotRef.current = null;
      // Destroying the plot took the line with it; drop the handle so a stale node
      // can't be styled by a placement that lands between teardown and remount.
      playheadRef.current = null;
    };
    // The gap refiner and the strokes are baked into the series at construction, so
    // switching between the live and stored sources — or ticking a window, which changes
    // both the colours and how many series there are — rebuilds the plot. Cheap at this
    // size, and it keeps the two from sharing one stale threshold. Ticking three boxes in
    // the open menu pays for it three times, which is human-paced and not worth batching.
    //
    // `live` is listed rather than left to the several dependencies derived from it: the
    // cursor hook reads it directly to decide whether the line is the page's or its own,
    // and a closure holding the wrong one would draw a line nothing moves.
  }, [
    project,
    xRange,
    live,
    gapThresholdX,
    lineCount,
    envelope,
    strokes,
    cropped,
    boundsRef,
    rangeRef,
    pendingRef,
    positionPlayhead,
    limitsRef,
    xAxisSize,
  ]);

  // A limit added, retimed or binned in the dialog, made visible. The draw hook reads the
  // ref, so nothing else about the plot has to change — and `false` because the data has
  // not: the scales here are fixed functions, so there is no range to re-accumulate.
  //
  // Its own effect rather than a line in the one that pushes data: that one runs on every
  // arriving record while live, and a limit is edited by hand a few times an evening.
  useEffect(() => {
    plotRef.current?.redraw(false);
  }, [limits]);

  // In and out points, bound to the hover rather than to the page: `i` crops the
  // timeframe to start at the instant under the pointer, `o` to end there.
  //
  // On the window, because there is nothing here to focus — the plot is a canvas, and
  // making a row's trace tabbable to carry two shortcuts would put a stop on every
  // row of the list for a keyboard user. Registered and removed with the hover
  // instead, which is also exactly the scope the feature is specified in: at most one
  // chart is hovered, so at most one listener is ever installed.
  const hovering = tip != null;
  useEffect(() => {
    if (!hovering) return;
    const onKeyDown = (e: KeyboardEvent) => {
      // Modified presses belong to the browser, and a chart that happens to sit under
      // the pointer must not swallow an `i` meant for a field somewhere else.
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const which =
        e.key === 'i' || e.key === 'I'
          ? 'start'
          : e.key === 'o' || e.key === 'O'
            ? 'end'
            : null;
      const at = hoverAtRef.current;
      if (!which || at == null) return;
      e.preventDefault();
      onCropRef.current?.({[which]: at});
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hovering, onCropRef]);

  // Putting a swept range away, which both of the menu's outcomes start with: the band
  // is the selection made visible, so it goes when the selection does — whether that is
  // a zoom (the crop it becomes is what the chart then shows, and a leftover overlay
  // would sit over a scale it no longer describes) or a dismissal. Without the hook, or
  // this would re-enter setSelect.
  //
  // Guarded, because the crop effect below calls this on every timeframe there is: a
  // timeline drag commits one per animation frame to every card on the list, and there
  // is no reason for a dozen charts to write a style each for a band none of them has.
  const clearSelection = useCallback(() => {
    if (!pendingRef.current) return;
    plotRef.current?.setSelect({left: 0, top: 0, width: 0, height: 0}, false);
    setPending(null);
  }, [pendingRef]);

  // Whether this row is anywhere near the viewport, and whether a crop arrived while
  // it wasn't. Refs, because nothing renders from either: scrolling a list must not
  // re-render the cards it moves past.
  const nearViewRef = useRef(true);
  const missedCropRef = useRef(false);

  // Push data in: once per new trace or mode, and every second while live — which is
  // also what re-runs the x-range closure and slides the live window along.
  // Deliberately not keyed on `range`: the stored trace covers the whole project, so
  // cropping doesn't change a single value.
  //
  // On the page's shared clock rather than an interval of its own, so a dozen open
  // cards redraw together once a second instead of painting a chart somewhere twelve
  // times a second — and skipped entirely for a row scrolled out of view, where the
  // projection (a merge and a sort across every monitor's window) and the redraw would
  // both be for nobody — it catches up on the next tick when it scrolls back, which on
  // a five-minute rolling window is a second of staleness nobody can see. The clock
  // does not call on registration, hence the eager apply.
  useEffect(() => {
    const apply = () => plotRef.current?.setData(project());
    apply();
    if (!live) return;
    return subscribeToClock(1000, () => {
      if (nearViewRef.current) apply();
    });
  }, [project, live, traces]);

  const applyCrop = useCallback(() => {
    const range = rangeRef.current;
    const plot = plotRef.current;
    if (!plot || !range) return;
    const {start, end} = range;
    const min = start / 1000;
    const max = end / 1000;
    // Already there, so there is nothing to redraw and nowhere new for the playhead to
    // be. Which is the ordinary case for exactly one chart: the one a pinch is happening
    // on, which set this scale itself a frame ago and would otherwise pay for uPlot
    // dropping its cached paths and clearing the canvas twice per frame of the gesture.
    // Every other caller arrives with numbers that did move.
    if (plot.scales.x.min === min && plot.scales.x.max === max) return;
    plot.setScale('x', {min, max});
    // The playhead keeps its instant while the axis under it moves, so the line has to
    // be put back on the pixel that instant now falls on. Here rather than in an effect
    // of its own, because the two other things that move the line — the instant itself
    // and a resize — reach it through the subscription and the ResizeObserver, neither
    // of which renders.
    positionPlayhead();
  }, [rangeRef, positionPlayhead]);

  // Cropping is a scale change and nothing more, which is the whole point of handing
  // the reduction to uPlot: it re-clips by binary search and redraws, with no data
  // rebuilt on either side. Live's window comes from the tick above instead.
  //
  // Deferred while the row is off-screen. A crop is what a timeline drag commits, once
  // per animation frame, to every card on the list at once — and setScale is not free even
  // when nothing moved: uPlot drops its cached paths and clears the canvas either way.
  // A list of locations is taller than the screen, so most of that redrawing is of rows
  // nobody is looking at.
  useEffect(() => {
    if (live) return;
    // A band is a region of *this* scale, and the scale is about to move under it —
    // whether the new crop came from this chart's own menu or from the timeline while
    // that menu stood open. The pixels it covers would name other instants afterwards,
    // so the selection goes with the timeframe it was drawn in.
    clearSelection();
    if (!nearViewRef.current) {
      missedCropRef.current = true;
      return;
    }
    applyCrop();
  }, [live, range?.start, range?.end, applyCrop, clearSelection]);

  // The other half of that: scrolling a deferred row back into view is what finally
  // pays for it. Generous margin, so the crop lands before the row is actually visible
  // rather than as it arrives.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        nearViewRef.current = entry?.isIntersecting ?? true;
        if (!nearViewRef.current || !missedCropRef.current) return;
        missedCropRef.current = false;
        applyCrop();
      },
      {rootMargin: '200px'},
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [applyCrop]);

  return (
    // The plot gets a wrapper of its own so the tooltip has something to be absolute
    // in: uPlot owns every child of its container, and React must not be inserting
    // siblings into a node another library is appending to.
    // Fills its card, down to the floor above. The plot inside is sized to this box by
    // the observer rather than the other way round, so the height comes from the layout
    // and nothing here has to know how many locations are sharing the page.
    <Box position="relative" h="full" minH={`${MIN_PLOT_HEIGHT}px`} w="full">
      <Box
        ref={containerRef}
        position="absolute"
        inset="0"
        overflow="hidden"
        // Over the trace the pointer picks an instant, so say so — the card around it may
        // be a link, and inheriting its pointer would promise a navigation instead. Both
        // modes: live has no playhead for the *page* to move, but the pointer still marks
        // a sample on this chart and still reads it out.
        cursor="crosshair"
        css={CHART_CSS}
      />
      {/* What a sweep across the trace opened, standing where it ended. A sibling of the
          plot and not a child of it, for the same reason the tooltip is: uPlot owns
          every node inside its container. Never both at once — a pending selection
          clears the tip and holds the cursor hook off. */}
      {pending && (
        <SelectionMenu
          at={pending}
          onZoom={() => {
            const {start, end} = pending;
            clearSelection();
            onCrop?.({start, end});
          }}
          onClose={clearSelection}
        />
      )}
      {tip && (
        <ChartTooltip left={tip.left} top={tip.top} fraction={tip.fraction}>
          <Text fontSize="xs" lineHeight="1.2">
            {tip.label}
          </Text>
          {/* One line per monitor per series with something to say at that instant, the
              value in that line's own colour. Spread to the pill's full width so the
              numbers line up under each other rather than after names of different
              lengths.

              What goes on the left is whatever the colour and the card don't already say:
              the monitor's name, which several lines of one series share; and the series'
              own name, where there are several series. Never both when one of them is the
              only one there is — a lone monitor's name on all five rows, or a lone series'
              name, is a column of the same word down a tooltip that has a few lines to
              spare.

              Named in full — `LCeq,5m`, not `5m` — because that is the only thing here
              that distinguishes a series from its twin in the other weighting: the two
              share a colour, and a tag would print the same string for both. */}
          {tip.readings.map(({deviceId, series, db}) => (
            <HStack
              key={`${deviceId} ${series}`}
              gap="3"
              justify="space-between"
              fontSize="xs"
              lineHeight="1.2"
            >
              <Text color="fg.muted">
                {[
                  lines.length > 1 || picked.length === 1 ? deviceId : null,
                  picked.length > 1 ? seriesLabel(series, live) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text fontWeight="bold" color={tokens[picked.indexOf(series)]}>
                {formatDb(db, unitLabel)}
              </Text>
            </HStack>
          ))}
        </ChartTooltip>
      )}
    </Box>
  );
}
