import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, HStack, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {subscribeToClock, useNoiseBuffers} from './context';
import {
  GAP_THRESHOLD_S,
  STORED_GAP_THRESHOLD_S,
  WINDOW_S,
  type DeviceSeries,
  type Weighting,
} from './noise';
import {
  alignedBuffers,
  alignedSeries,
  bufferColumn,
  loudestColumn,
  maskToWindows,
  seriesFor,
} from './series';
import {formatDb, metricTag, weightingUnit, type LevelMetric} from './level';
import {
  chartAxisStyle,
  cursorAnchor,
  dbAxis,
  fmtHourMinute,
  instantLabel,
  makeSampleGapsRefiner,
  timeGridStepS,
  useLatest,
  zonedDate,
} from './chartUtils';
import {ChartTooltip} from './ChartTooltip';
import {usePlayheadEffect, type DeviceWindows} from './projectView';

// The level trace of one location: a line per monitor that has ever stood there, each
// clipped to the stretches it did, a sparse label up each side, no legend. Its own plot
// rather than a configuration of NoiseTimeChart, which is built for a full-page chart —
// nine toggleable series, a tooltip, drag-to-zoom — none of which fits (or is wanted) at
// row height. The styling it does share comes from chartUtils, so a row and the detail
// page read against the same dB scale.
//
// A chart of the place and not of its monitors, which is the whole reason the lines are
// windowed: a monitor's history covers the event wherever it stood, so drawn whole under
// one location it would plot every other stage it visited. Clipped, consecutive monitors
// read as one continuous trace of the location — and the chart is drawn even where there
// is nothing to plot, because an empty pair of axes says "nothing was measured here" and
// a missing chart says nothing at all.
//
// Which quantity it plots is the header's choice, the same one the coloured number on
// the row is read in: both dropdowns pick a column — of the stored payload when not
// live, of the rolling buffer when live — and neither side computes anything the
// device did not report.
//
// Every line is that window's colour, monitors and all: two monitors at one location
// are two readings of the same place, and the useful thing to see is the envelope they
// make — which is loudest, and where they part. Telling them apart by name is what the
// header above the chart and this one's tooltip are for, which is why there is no
// legend: at row height it would cost more of the trace than it explained.
//
// Two sources, one shape, chosen by `live`:
//   live off — the devices' whole stored history at one point per minute, already on a
//              shared x (see alignedSeries). uPlot clips it to the x-scale and reduces
//              it to min/max per pixel column itself, so cropping the timeline is a
//              redraw here and no work at all upstream.
//   live on  — the layout's rolling MQTT buffers, merged onto one x and re-projected
//              once a second over their last WINDOW_S, so a row moves while you watch.

// What each monitor read at the sample the cursor is on — the body of the tooltip, and
// the only place this chart says which of its lines is which. Every line is the window's
// colour on purpose (see above), so with two monitors standing at a location the trace
// alone cannot be attributed; hovering is how you ask.
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
  multi: boolean,
  gapThresholdX: number,
): Array<{deviceId: string; db: number}> {
  const idx = u.cursor.idx;
  if (idx == null) return [];
  const dataX = u.data[0]![idx] as number | undefined;
  const cursorX = u.posToVal(u.cursor.left ?? -1, 'x');
  if (dataX == null || Math.abs(cursorX - dataX) > gapThresholdX) return [];
  // Column 0 is the x, and with several monitors column 1 is the filled envelope — the
  // monitors' own lines start after whichever of those the projection built.
  const first = multi ? 2 : 1;
  const out: Array<{deviceId: string; db: number}> = [];
  for (const [i, {deviceId}] of lines.entries()) {
    const db = u.data[first + i]?.[idx];
    if (db != null) out.push({deviceId, db});
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

// Label every nth grid line, n being the fewest that leaves X_LABEL_SPACE between the
// ones that survive. Measured off the first two splits — they are evenly spaced, this
// axis having been handed a single increment — so it costs one conversion rather than
// a text measurement, and follows a rescale without being told.
const labelStride = (u: uPlot, splits: number[]): number => {
  if (splits.length < 2) return 1;
  const gap = Math.abs(
    u.valToPos(splits[1]!, 'x') - u.valToPos(splits[0]!, 'x'),
  );
  return gap > 0 ? Math.max(1, Math.ceil(X_LABEL_SPACE / gap)) : 1;
};

// The line's own colour at 15 % (8-digit hex is canvas-legal), so the trace reads
// as an area without the line getting lost in it.
const fill = (stroke: string) => `${stroke}26`;
// The trace takes whatever height the card gives it and never less than this. A list
// of two locations should be two tall charts rather than two short ones over a gap, so
// the cards divide the page between them and this follows — but a list of ten on a
// laptop would be slivers, and below this the list scrolls instead.
//
// The floor is what the chart used to be fixed at: it includes the axis under the plot,
// so the trace itself gets what is left — dbAxis spans 80 dB, which over that remainder
// is eight grid gaps of ~14 px each, still enough to read a level off the grid rather
// than merely be reminded there is one.
//
// Not chartUtils' plotHeight, which floors at 100 px for the full-page charts.
const MIN_HEIGHT = 128;

const traceHeight = (container: HTMLElement): number =>
  Math.max(MIN_HEIGHT, container.clientHeight);

// Horizontal grid every 10 dB, and a number on every second line of it — see the
// axis below for why not on every one.
const DB_GRID_STEP = 10;
const DB_LABEL_STEP = 20;

// The axes' own type: a size small enough that two gutters cost a row less than the
// trace gains by being readable, which means smaller than uPlot's 12 px default.
// Concrete rather than a Chakra token, because this is drawn on a canvas — a `var()`
// would resolve to nothing and take the labels with it.
const AXIS_FONT = '10px ui-monospace, SFMono-Regular, Menlo, monospace';
// What those gutters cost: enough for "110" at the font above, and for one line of it
// under the plot. Both come out of the box's height, so the trace is that much
// shorter than the card gives it.
const Y_AXIS_W = 26;
const X_AXIS_H = 15;
// The closest two time labels may sit, which decides how many grid lines go
// unlabelled between them. Sized for "22:15" at the font above with room to breathe —
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
  // this chart. The same translucent white the full-page chart gives its drag region,
  // so the two gestures look like the one gesture they are.
  '& .u-select': {
    background: 'rgba(255, 255, 255, 0.15)',
  },
  [`& .${PLAYHEAD_CLASS}`]: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // A hairline: at row height the trace is only ~128 px of chart, and anything
    // thicker reads as a band over the samples it is meant to point at.
    width: '1px',
    // Centred on its instant rather than starting at it, so it marks the sample the
    // pointer is on rather than the pixel after it. In the margin rather than the
    // transform, which positionPlayhead writes and should hold nothing else.
    marginLeft: '-0.5px',
    background: 'var(--chakra-colors-gray-50)',
    // The cursor underneath it has to keep receiving the pointer, or the line would
    // stall the moment it caught up with what's moving it.
    pointerEvents: 'none',
  },
} as const;

export function LevelTrace({
  lines,
  live,
  metric,
  weighting,
  range,
  onScrub,
  onCrop,
  series,
}: {
  // Every monitor this location has ever had, with the windows it had them for. One
  // line each, clipped to those windows; one line is the ordinary case, and none — a
  // location nothing has stood at yet — draws an empty chart rather than nothing.
  lines: DeviceWindows[];
  live: boolean;
  // Which Leq window and which weighting the page is showing. `series` was already
  // resolved for both; this pair is what picks the matching column out of the live
  // buffer, and what colours the line — the same shade the full-page chart gives that
  // window, so a row says which one it is without a legend.
  metric: LevelMetric;
  weighting: Weighting;
  // The crop in epoch ms — the x-range when not live, and the only thing a timeline
  // drag changes here.
  range: {start: number; end: number};
  // Where the pointer is, in epoch ms, once per animation frame while it's over the
  // plot (uPlot batches its own cursor updates to a frame). Omitted where there's
  // nothing to scrub.
  onScrub?: (at: number) => void;
  // Crops the page's timeframe to what this trace was pointed at, in epoch ms. Two
  // gestures, one answer, because they differ only in how much of the crop they name:
  //
  //   `i` / `o` — one end, while the pointer is over this plot. The in/out keys of
  //               every editing timeline, and the fastest way to bound the crop on the
  //               peak you are looking at rather than dragging two thumbs towards it.
  //               Bound to the hover, so the keys belong to the trace and not the page.
  //   a drag    — both ends, swept across the trace (uPlot's own rubber band).
  //
  // An omitted end keeps the crop's own. Absent where there is no crop to set, which
  // also disarms the drag.
  onCrop?: (crop: {start?: number; end?: number}) => void;
  // Every device's whole stored trace, at one point per minute — the page's own
  // record, passed through rather than picked apart here. Absent while it loads, and
  // missing an entry for a device that measured nothing in the project.
  series?: Record<string, DeviceSeries>;
}) {
  // The buffers alone: a chart has nothing to say about a record arriving — the
  // canvas is redrawn by its own tick below — so it must not subscribe to them.
  const deviceData = useNoiseBuffers();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Read through refs by the plot's long-lived closures, so a mutating live buffer
  // or a new range never leaves them stale and never rebuilds the plot — the same
  // treatment NoiseTimeChart gives its props. `live` is deliberately not one of them:
  // the gap threshold below is derived from it and is baked into the series at
  // construction, so switching source rebuilds the plot either way.
  const seriesRef = useLatest(series);
  const rangeRef = useLatest(range);
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
  // How many y columns the plot has. At least one, so a location with no monitor yet
  // still has a series to be empty in rather than an axis pair uPlot would reject.
  const lineCount = Math.max(1, lines.length);
  // Whether the fill is a series of its own. Read by both the projection and the series
  // list below, which have to agree on the column count — so it is derived from the
  // count they share rather than recounted, and it only changes when the monitor count
  // crosses two, so it can't rebuild the plot idly.
  const multi = lineCount > 1;
  // Through a ref like the rest: switching weighting swaps which buffer column is
  // plotted, and it must not tear the plot down to do it. The live projection reruns
  // every second anyway, and a new `series` lands with it when not live. (Switching
  // the *window* does rebuild the plot — see the stroke below — but this still has to
  // be right on the frame it is rebuilt on.)
  const colRef = useLatest(bufferColumn(metric, weighting));
  // The window's colour from the shared table, so the row and the device page draw
  // the same line in the same shade. uPlot bakes a series' stroke in at construction,
  // so unlike the column this one does rebuild the plot; it changes only when someone
  // moves the dropdown, and at this size a rebuild is cheap.
  const stroke = seriesFor(metric, weighting).stroke;
  // What the tooltip's numbers are in, spelled the same way the card's header spells it
  // — the two are readings of the same quantity and must not look like different ones.
  const unitLabel = `${weightingUnit(weighting)} ${metricTag(metric, live)}`;
  const onScrubRef = useLatest(onScrub);
  // The instant the page is looking at, written by the subscription below rather than
  // taken as a prop. The playhead is page state that moves on every frame of a hover
  // over any row on the page, so a prop would mean re-rendering every chart at once to
  // hand each of them a number it only writes into a ref — see usePlayheadEffect.
  const currentRef = useRef<number | null>(null);

  // The hovered instant and what every monitor read at it, anchored in container
  // pixels. Same readout NoiseTimeChart gives its own cursor, and through the same two
  // helpers — a row is smaller, not different.
  //
  // The readings are here rather than only in the card's header because the header
  // prints one number for the whole location (the loudest monitor's), while this chart
  // may be drawing two lines at once: what the tooltip answers is which line is which,
  // which is also what the chart has no legend for.
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    label: string;
    readings: Array<{deviceId: string; db: number}>;
  } | null>(null);

  // The instant the pointer is on, for the keys below to read. A ref and not part of
  // `tip`: it is rewritten on every frame of a hover, and nothing renders from it.
  const hoverAtRef = useRef<number | null>(null);
  const onCropRef = useLatest(onCrop);

  // How much of the instant is worth printing, decided by how wide the window is: a
  // crop inside one day needs no date, a festival-length one would otherwise say
  // 22:15 four times over. Shared with the timeline's readout, which labels the same
  // instant a hover here puts under the playhead — see instantLabel.
  const formatRef = useLatest(instantLabel(live, range.end - range.start));

  const playheadRef = useRef<HTMLDivElement | null>(null);

  // Where the playhead stands on this chart, or out of sight when it stands outside
  // the crop this one is showing (or when there is no playhead at all).
  //
  // Called two ways, hence the default: with an instant, by the page's playhead
  // subscription below; and with none, by a resize or a rescale, which move the pixel
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
    // Nothing has ever stood here: one empty column, so the axes and their grid draw
    // over an empty crop rather than the card holding a gap where a chart should be.
    if (current.length === 0) return [[], []] as uPlot.AlignedData;
    // A device with no records yet has no buffer at all (only ingest creates one),
    // and one that measured nothing in the project has no stored trace; either way
    // the aligners pad it to the shared x rather than dropping a column uPlot is
    // expecting.
    const [xs, ...raw] = live
      ? alignedBuffers(
          current.map((l) => deviceData.current[l.deviceId]),
          colRef.current,
        )
      : alignedSeries(current.map((l) => seriesRef.current?.[l.deviceId]));
    // What makes this a chart of the location: each monitor draws only where it stood
    // here. Both sources are clipped, so a monitor that has moved on stops the moment
    // its assignment ended rather than the moment it next goes quiet.
    const columns = raw.map((column, i) =>
      maskToWindows(xs as number[], column, current[i]!.windows),
    );
    if (!multi) return [xs, ...columns] as uPlot.AlignedData;
    // With several monitors the filled area is the loudest of them, in front of which
    // their lines are drawn — see the series below.
    return [
      xs,
      loudestColumn(xs as number[], columns, gapThresholdX),
      ...columns,
    ] as uPlot.AlignedData;
    // Keyed on the lines rather than the array: the same monitors over the same
    // windows are the same projection, and a new array of them every render is not a
    // new plot.
  }, [
    linesKey,
    linesRef,
    deviceData,
    live,
    multi,
    seriesRef,
    colRef,
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
    const {start, end} = rangeRef.current;
    return [start / 1000, end / 1000];
  }, [live, rangeRef]);

  // Whether a drag on this trace crops anything, which uPlot bakes in at construction
  // — hence a dependency of the effect below rather than another ref. In practice it
  // tracks `live`, which rebuilds the plot anyway.
  const selectable = onCrop != null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // One refiner for every line: it closes over nothing but the threshold, and uPlot
    // only ever calls it.
    const gaps = makeSampleGapsRefiner(gapThresholdX);

    // Both axes carry a grid and a thin row of labels — enough to read a level and a
    // time off the trace without going to the timeline for one and the row's numbers
    // for the other. No ticks: at this size the grid line the label sits on is the
    // tick, and marks beside it would only thicken the gutters.
    const style = chartAxisStyle();
    const axisBase: uPlot.Axis = {
      show: true,
      gap: 2,
      font: AXIS_FONT,
      ticks: {show: false},
      stroke: style.stroke,
      grid: {show: true, stroke: style.grid.stroke, width: 1},
    };

    const plot = new uPlot(
      {
        width: container.clientWidth || 300,
        height: traceHeight(container),
        legend: {show: false},
        // The line you see under the pointer is the playhead, drawn by every row at
        // once — so uPlot's own guides stay off and this cursor exists only to report
        // where the pointer is. Same end as uPlot's sync-cursor demo, reached through
        // the page's selection rather than a sync key: the timeline, the dB readouts
        // and the map pins have to follow the pointer too, and none of them is a plot.
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
            x: selectable,
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
              // Clear the band before committing: the crop it becomes is what the
              // chart then shows, so a leftover overlay would sit over a scale it no
              // longer describes. Without the hook, or this would re-enter.
              u.setSelect({left: 0, top: 0, width: 0, height: 0}, false);
              onCropRef.current?.({
                start: u.posToVal(left, 'x') * 1000,
                end: u.posToVal(left + width, 'x') * 1000,
              });
            },
          ],
          setCursor: [
            (u) => {
              const left = u.cursor.left;
              // Negative once the pointer leaves. The tooltip goes with it, but the
              // playhead stays where it was rather than snapping back: it's the page's
              // instant now, and the row you hovered is usually the one you then want
              // to read a number off.
              if (left == null || left < 0) {
                hoverAtRef.current = null;
                setTip(null);
                return;
              }
              // Out of uPlot's seconds once, here at its edge: everything downstream
              // of this — the ref, the page's playhead, the label — is milliseconds.
              const atMs = u.posToVal(left, 'x') * 1000;
              hoverAtRef.current = atMs;
              onScrubRef.current?.(atMs);
              setTip({
                ...cursorAnchor(u, container, left, u.cursor.top ?? 0),
                label: formatRef.current(atMs),
                readings: readingsAt(u, linesRef.current, multi, gapThresholdX),
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
            ...axisBase,
            size: X_AXIS_H,
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
              const step = labelStride(u, splits);
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
          // One line per 10 dB, however tight: eight gaps across a row can fall well
          // under any default minimum, and an increment that can't have its minimum
          // spacing is one uPlot refuses to use. So the minimum goes to one pixel —
          // the fixed spacing *is* the point here.
          //
          // Labelled every other line: nine numbers up the side of a row-height chart
          // would touch, and the unlabelled lines between two labels are still the
          // 10 dB grid the trace is read against. Bare numbers, no unit — which dB
          // this is depends on the weighting, and the row's own readings say so.
          {
            ...axisBase,
            size: Y_AXIS_W,
            incrs: [DB_GRID_STEP],
            space: 1,
            values: (_u, splits) =>
              splits.map((v) => (v % DB_LABEL_STEP ? null : String(v))),
          },
        ],
        // Right and top only: the axes reserve the other two. The right keeps the last
        // time label from being clipped by the edge of the canvas, and the top keeps
        // the trace off it at 110 dB.
        padding: [2, 8, 0, 0],
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
          ...(multi
            ? [
                {
                  stroke: 'transparent',
                  fill: fill(stroke),
                  width: 0,
                  spanGaps: false,
                  gaps,
                  points: {show: false},
                },
              ]
            : []),
          // One per monitor — or one empty line where there is no monitor, which is
          // what keeps the axes drawn at a location nothing has stood at yet.
          ...Array.from({length: lineCount}, () => ({
            stroke,
            fill: multi ? undefined : fill(stroke),
            width: 1.25,
            spanGaps: false,
            gaps,
            points: {show: false},
          })),
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
    positionPlayhead();

    // Only the width can change: the row gives the trace a fixed height. A new width
    // is a new pixel for the same instant, so the playhead is replaced with it.
    const ro = new ResizeObserver(() => {
      plot.setSize({
        width: container.clientWidth,
        height: traceHeight(container),
      });
      positionPlayhead();
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
      // Destroying the plot took the line with it; drop the handle so a stale node
      // can't be styled by a placement that lands between teardown and remount.
      playheadRef.current = null;
    };
    // The gap refiner and the stroke are baked into the series at construction, so
    // switching between the live and stored sources — or switching window — rebuilds
    // the plot. Cheap at this size, and it keeps the two from sharing one stale
    // threshold.
  }, [
    project,
    xRange,
    gapThresholdX,
    lineCount,
    multi,
    stroke,
    selectable,
    positionPlayhead,
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
    const {start, end} = rangeRef.current;
    plotRef.current?.setScale('x', {min: start / 1000, max: end / 1000});
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
    if (!nearViewRef.current) {
      missedCropRef.current = true;
      return;
    }
    applyCrop();
  }, [live, range.start, range.end, applyCrop]);

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
    <Box position="relative" h="full" minH={`${MIN_HEIGHT}px`} w="full">
      <Box
        ref={containerRef}
        position="absolute"
        inset="0"
        overflow="hidden"
        // Over the trace the pointer picks an instant, so say so — the row around it
        // is a link, and inheriting its pointer would promise a navigation instead.
        cursor={onScrub ? 'crosshair' : undefined}
        css={CHART_CSS}
      />
      {tip && (
        <ChartTooltip left={tip.left} top={tip.top}>
          <Text fontSize="xs" lineHeight="1.2">
            {tip.label}
          </Text>
          {/* One line per monitor with something to say at that instant, the value in
              the line's own colour — which with two monitors is the same colour twice,
              so the name beside it is what tells them apart. Spread to the pill's full
              width so the numbers line up under each other rather than after names of
              different lengths. */}
          {tip.readings.map(({deviceId, db}) => (
            <HStack
              key={deviceId}
              gap="3"
              justify="space-between"
              fontSize="xs"
              lineHeight="1.2"
            >
              <Text color="gray.400">{deviceId}</Text>
              <Text fontWeight="bold" color={stroke}>
                {formatDb(db, unitLabel)}
              </Text>
            </HStack>
          ))}
        </ChartTooltip>
      )}
    </Box>
  );
}
