import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, HStack, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {subscribeToClock, useNoiseBuffers} from './context';
import {
  GAP_THRESHOLD_S,
  STORED_GAP_THRESHOLD_S,
  WINDOW_S,
  type Weighting,
} from './noise';
import {
  alignedBuffers,
  alignedSeries,
  bufferColumn,
  seriesFor,
  traceColumn,
  traceData,
} from './series';
import {
  formatDb,
  metricTag,
  weightingUnit,
  type LevelMetric,
  type PickedMetrics,
} from './level';
import {type MetricTraces} from './projectLogs';
import {themeHex} from '../../theme-noise';
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
// Which quantities it plots is the header's choice: every picked window is a column — of
// the stored payload when not live, of the rolling buffer when live — and neither side
// computes anything the device did not report. Usually one, because usually one is the
// question; several when the question is a comparison, which is the reason the pick is a
// set at all.
//
// Colour attributes the window and the name attributes the monitor, which is the whole
// legend this chart has:
//
//   across windows — each is its own shade off the series table (yellow through red, see
//                    theme-noise), the same shade the number in it is printed in, so three
//                    lines are told apart without a key.
//   within one     — every monitor of a window draws in that one colour: two monitors at a
//                    location are two readings of the same place, and the useful thing to
//                    see is the envelope they make. Which of them is which is what the
//                    header's names and this one's tooltip are for.
//
// So there is still no legend of its own: at row height it would cost more of the trace
// than it explained, and on the device page the tile row above the chart already is one.
//
// The filled area under the trace belongs to a *single* window (see the series list): the
// windows are nested — Peak ≥ Fmax ≥ Leq,1m ≳ Leq,5m ≳ Leq,30m — so an area under any one
// of several paints over the quieter lines, and two at 15 % stack into a shade that reads
// as data. One window keeps the fill it always had; several are lines only.
//
// Two sources, one shape, chosen by `live`:
//   live off — the devices' whole stored history at one point per minute, already on a
//              shared x (see alignedSeries). uPlot clips it to the x-scale and reduces
//              it to min/max per pixel column itself, so cropping the timeline is a
//              redraw here and no work at all upstream.
//   live on  — the layout's rolling MQTT buffers, merged onto one x and re-projected
//              once a second over their last WINDOW_S, so a row moves while you watch.

// What each monitor read at the sample the cursor is on, in each window drawn — the body of
// the tooltip, and the only place this chart names its monitors. Colour already says which
// window a line is (see above), but every monitor of a window shares it, so with two
// standing at a location the trace alone cannot be attributed; hovering is how you ask.
//
// Monitor-outer, window-inner, so a monitor's readings arrive as a run: the tooltip is read
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
  metrics: readonly LevelMetric[],
  envelope: boolean,
  gapThresholdX: number,
): Array<{deviceId: string; metric: LevelMetric; db: number}> {
  const idx = u.cursor.idx;
  if (idx == null) return [];
  const dataX = u.data[0]![idx] as number | undefined;
  const cursorX = u.posToVal(u.cursor.left ?? -1, 'x');
  if (dataX == null || Math.abs(cursorX - dataX) > gapThresholdX) return [];
  const out: Array<{deviceId: string; metric: LevelMetric; db: number}> = [];
  for (const [d, {deviceId}] of lines.entries()) {
    for (const [m, metric] of metrics.entries()) {
      // Never counted out here: where a column sits is the projection's layout, and a
      // reader that worked it out for itself would go on printing plausible levels
      // attributed to the wrong monitor the day the layout moved.
      const db = u.data[traceColumn(m, d, lines.length, envelope)]?.[idx];
      if (db != null) out.push({deviceId, metric, db});
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
  // Which Leq windows and which weighting the page is showing. `series` was already
  // resolved for both; this pair is what picks the matching columns out of the live buffer,
  // and what colours each line — the same shade the number in that window is printed in, so
  // a row says which is which without a legend.
  //
  // Every window here has a series under this weighting. `setWeighting` is what keeps that
  // true, by moving both in one update (see useLevelPick) — so nothing is filtered here: a
  // chart that dropped a column its series list still had would draw a monitor's readings
  // under another monitor's name.
  metrics: PickedMetrics;
  weighting: Weighting;
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
      series?: never;
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
      // plot (uPlot batches its own cursor updates to a frame).
      onScrub: (at: number) => void;
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
      // Every device's whole stored trace, at one point per minute, per picked window — the
      // page's own record, passed through rather than picked apart here. Absent while it
      // loads, and missing an entry for a device that measured nothing in the project.
      series?: MetricTraces;
    }
);

export function LevelTrace({
  lines,
  live,
  metrics,
  weighting,
  range,
  bounds,
  onScrub,
  onCrop,
  series,
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
  const seriesRef = useLatest(series);
  const rangeRef = useLatest(range);
  // Through a ref for the same reason as the range, and read only from inside a gesture:
  // the window's right edge follows the clock on a running festival, so the object is new
  // every minute and a dependency on it would rebuild the plot for a number no gesture
  // was using at the time.
  const boundsRef = useLatest(bounds);
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
  // The picked windows the same way, and for the same reason: this component re-renders on
  // every frame of a hover, and everything below derived from the set — the colours, the
  // buffer columns, the effect that builds the plot — would otherwise be recomputed or torn
  // down for a set that had not changed.
  const metricsKey = metrics.join(' ');
  // How many monitors the plot has a line for, per window. At least one, so a location with
  // no monitor yet still has a series to be empty in rather than an axis pair uPlot would
  // reject.
  const lineCount = Math.max(1, lines.length);
  // Whether the filled area is a series of its own — which it is for exactly one shape:
  // one window, several monitors, where the area belongs under the loudest of them rather
  // than under each (see the series list). One flag rather than a monitor count and a
  // window count consulted separately, because the projection, that list and the tooltip
  // all have to agree about whether the column is there at all.
  const envelope = lines.length > 1 && metrics.length === 1;
  // Through a ref like the rest: switching weighting swaps which buffer columns are
  // plotted, and it must not tear the plot down to do it. The live projection reruns
  // every second anyway, and a new `series` lands with it when not live. (Ticking a
  // *window* does rebuild the plot — see the strokes below — but this still has to
  // be right on the frame it is rebuilt on.)
  const colsRef = useLatest(
    useMemo(
      () => metrics.map((m) => bufferColumn(m, weighting)),
      [metricsKey, weighting],
    ),
  );
  // Each window's colour from the shared table, so the row and the device page draw the
  // same line in the same shade. uPlot bakes a series' stroke in at construction, so unlike
  // the columns these do rebuild the plot; they change only when someone ticks a box, and at
  // this size a rebuild is cheap. (A weighting flip does not change them — a kind's two
  // weightings are one measurement under a different filter, and one colour.)
  //
  // Two forms of the same colours: the tokens for the tooltip, which is Chakra and wants
  // the name, and the hexes for the canvas, which cannot take one. Memoized so the array
  // identity is stable, the plot-building effect depending on it directly.
  const tokens = useMemo(
    () => metrics.map((m) => seriesFor(m, weighting).color),
    [metricsKey, weighting],
  );
  const strokes = useMemo(() => tokens.map(themeHex), [tokens]);
  // What the tooltip's numbers are in, spelled the same way the card's header spells it
  // — the two are readings of the same quantity and must not look like different ones.
  // The window's own tag rides along only where there is one window: with several, the tag
  // is what names the row, and printing it twice per line would say there were two.
  const unit = weightingUnit(weighting);
  const unitLabel =
    metrics.length === 1 ? `${unit} ${metricTag(metrics[0], live)}` : unit;
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
  // one number for the whole location, in one window (the loudest monitor's, in the
  // primary), while this chart may be drawing a line per monitor per window: what the
  // tooltip answers is which line is which, which is also what the chart has no legend for.
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    label: string;
    readings: Array<{deviceId: string; metric: LevelMetric; db: number}>;
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

  // How much of the instant is worth printing, decided by how wide the window is: a
  // crop inside one day needs no date, a festival-length one would otherwise say
  // 22:15 four times over. Shared with the timeline's readout, which labels the same
  // instant a hover here puts under the playhead — see instantLabel.
  // Live's label is seconds whatever the span, so the missing crop costs nothing there.
  const formatRef = useLatest(
    instantLabel(live, range ? range.end - range.start : 0),
  );

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
          metrics.map((m) =>
            current.map((l) => seriesRef.current?.[m]?.[l.deviceId]),
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
        metricCount: metrics.length,
        envelope,
        holdX: gapThresholdX,
      },
    ) as uPlot.AlignedData;
    // Keyed on digests rather than on the arrays: the same monitors over the same windows
    // in the same set of quantities are the same projection, and new arrays of them every
    // render are not a new plot.
  }, [
    linesKey,
    metricsKey,
    linesRef,
    deviceData,
    live,
    envelope,
    seriesRef,
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
              // Negative once the pointer leaves. The tooltip goes with it. The playhead
              // stays where it was rather than snapping back: it's the page's instant
              // now, and the row you hovered is usually the one you then want to read a
              // number off — except while live, where it was never the page's.
              if (left == null || left < 0) {
                hoverAtRef.current = null;
                setTip(null);
                // Live's line is the pointer's own and goes with it, unlike the page's
                // playhead: there is no instant for it to be left standing on, and the
                // window slides out from under it a second later anyway.
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
                  metrics,
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
    xAxisSize,
  ]);

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
  }, [project, live, series]);

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
        <ChartTooltip left={tip.left} top={tip.top}>
          <Text fontSize="xs" lineHeight="1.2">
            {tip.label}
          </Text>
          {/* One line per monitor per window with something to say at that instant, the
              value in that line's own colour. Spread to the pill's full width so the
              numbers line up under each other rather than after names of different
              lengths.

              What goes on the left is whatever the colour and the card don't already say:
              the monitor's name, which several lines of one window share; and the window's
              tag, where there are several windows. Never both when one of them is the only
              one there is — a lone monitor's name on all five rows, or a lone window's tag,
              is a column of the same word down a tooltip that has a few lines to spare. */}
          {tip.readings.map(({deviceId, metric, db}) => (
            <HStack
              key={`${deviceId} ${metric}`}
              gap="3"
              justify="space-between"
              fontSize="xs"
              lineHeight="1.2"
            >
              <Text color="fg.muted">
                {[
                  lines.length > 1 || metrics.length === 1 ? deviceId : null,
                  metrics.length > 1 ? metricTag(metric, live) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text fontWeight="bold" color={tokens[metrics.indexOf(metric)]}>
                {formatDb(db, unitLabel)}
              </Text>
            </HStack>
          ))}
        </ChartTooltip>
      )}
    </Box>
  );
}
