import {useCallback, useEffect, useRef, useState} from 'react';
import {Box, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {useNoiseLive} from './context';
import {
  GAP_THRESHOLD_S,
  STORED_GAP_THRESHOLD_S,
  WINDOW_S,
  type DeviceSeries,
  type Weighting,
} from './noise';
import {bufferColumn, seriesFor} from './series';
import type {LevelMetric} from './level';
import {
  chartAxisStyle,
  cursorAnchor,
  dbAxis,
  fmtTime,
  makeGapsRefiner,
  spanTimeFormat,
  timeGridStepS,
  useLatest,
  zonedDate,
} from './chartUtils';
import {ChartTooltip} from './ChartTooltip';

// The level trace behind one device row: a single filled line, no axes, no legend.
// Its own plot rather than a configuration of NoiseTimeChart, which is built for a
// full-page chart — nine toggleable series, a tooltip, drag-to-zoom — none of which
// fits (or is wanted) at row height. The styling it does share comes from chartUtils,
// so a row and the detail page read against the same dB scale.
//
// Which quantity it plots is the header's choice, the same one the coloured number on
// the row is read in: both dropdowns pick a column — of the stored payload when not
// live, of the rolling buffer when live — and neither side computes anything the
// device did not report.
//
// Two sources, one shape, chosen by `live`:
//   live off — the device's whole stored history at one point per minute. uPlot clips
//              it to the x-scale and reduces it to min/max per pixel column itself,
//              so cropping the timeline is a redraw here and no work at all upstream.
//   live on  — the layout's rolling MQTT buffer, re-projected once a second over
//              its last WINDOW_S, so a row moves while you watch it.

// Whether a keystroke is somebody writing rather than reaching for a shortcut. The
// dialogs on this page are full of fields, and one of them may well be open over a
// row the pointer is still resting on.
const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// The line's own colour at 15 % (8-digit hex is canvas-legal), so the trace reads
// as an area without the line getting lost in it.
const fill = (stroke: string) => `${stroke}26`;
// Fixed, and not chartUtils' plotHeight: that one floors at 100 px for the
// full-page charts, whose containers are flex-sized. dbAxis spans 80 dB, so the
// 10 dB grid below is always eight gaps — at this height ~15 px each, which is
// what makes a level readable off the grid rather than merely suggested by it.
const HEIGHT = 128;
const EMPTY: uPlot.AlignedData = [[], []];

// Horizontal grid every 10 dB, so the trace can be read against a level without
// an axis to label it.
const DB_GRID_STEP = 10;

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

// Hoisted, and not an inline object on the Box: hovering re-renders every chart on
// the page once per frame, and Emotion re-serializes a fresh style object each time
// it sees one. A module constant is hashed once for the whole session.
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
    width: '2px',
    // Centred on its instant rather than starting at it, so it lines up with the
    // timeline's own playhead, which is drawn the same way. In the margin rather than
    // the transform, which positionPlayhead writes and should hold nothing else.
    marginLeft: '-1px',
    background: 'var(--chakra-colors-gray-50)',
    // The cursor underneath it has to keep receiving the pointer, or the line would
    // stall the moment it caught up with what's moving it.
    pointerEvents: 'none',
  },
} as const;

export function DeviceRowChart({
  device,
  live,
  metric,
  weighting,
  range,
  current,
  onScrub,
  onCrop,
  series,
}: {
  device: string;
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
  // The instant the page is looking at, in epoch ms, or null for none — which is what
  // live mode is, since it reads whatever is standing there now.
  current: number | null;
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
  // This device's whole stored trace, at one point per minute; absent while it loads,
  // and for a device that measured nothing in the project.
  series?: DeviceSeries;
}) {
  const {deviceData} = useNoiseLive();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Read through refs by the plot's long-lived closures, so a mutating live buffer
  // or a new range never leaves them stale and never rebuilds the plot — the same
  // treatment NoiseTimeChart gives its props. `live` is deliberately not one of them:
  // the gap threshold below is derived from it and is baked into the series at
  // construction, so switching source rebuilds the plot either way.
  const seriesRef = useLatest(series);
  const rangeRef = useLatest(range);
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
  // Both through refs for the usual reason, and here it's the whole point: the
  // playhead is page state, so every row's chart gets a new one on every frame of a
  // hover over any one of them. Rebuilding a plot for that — or even re-registering a
  // hook — would make the synced cursor cost more than the charts do.
  const currentRef = useLatest(current);
  const onScrubRef = useLatest(onScrub);

  // The hovered instant, anchored in container pixels. Same readout NoiseTimeChart
  // gives its own cursor, and through the same two helpers — a row is smaller, not
  // different.
  const [tip, setTip] = useState<{
    left: number;
    top: number;
    label: string;
  } | null>(null);

  // The instant the pointer is on, for the keys below to read. A ref and not part of
  // `tip`: it is rewritten on every frame of a hover, and nothing renders from it.
  const hoverAtRef = useRef<number | null>(null);
  const onCropRef = useLatest(onCrop);

  // How much of the instant is worth printing, decided by how wide the window is: a
  // crop inside one day needs no date, a festival-length one would otherwise say
  // 22:15 four times over. Live is a window of minutes, so it gets seconds instead.
  const formatRef = useLatest(
    live ? fmtTime : spanTimeFormat(range.end - range.start),
  );

  const playheadRef = useRef<HTMLDivElement | null>(null);

  // Where the playhead stands on this chart, or out of sight when it stands outside
  // the crop this one is showing (or when there is no playhead at all). Imperative
  // and ref-driven so it can be called from the plot's own callbacks — a resize and
  // a rescale move the line without the instant having changed.
  const positionPlayhead = useCallback(() => {
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
  }, [currentRef]);

  const project = useCallback((): uPlot.AlignedData => {
    if (live) {
      const buffer = deviceData.current[device];
      // A device with no records yet has no buffer at all (only ingest creates
      // one), which is an empty chart rather than an error.
      return buffer
        ? ([buffer[0], buffer[colRef.current]] as uPlot.AlignedData)
        : EMPTY;
    }
    const loaded = seriesRef.current;
    return loaded ? ([loaded.xs, loaded.db] as uPlot.AlignedData) : EMPTY;
  }, [device, deviceData, live, seriesRef, colRef]);

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

  // What counts as a break in the line, which differs by source: the live buffer omits
  // samples that never arrived, so the refiner has to spot the jump, while a stored
  // trace carries an explicit null that uPlot breaks on by itself.
  const gapThresholdX = live ? GAP_THRESHOLD_S : STORED_GAP_THRESHOLD_S;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Both axes exist only to carry a grid: uPlot draws no grid for an axis that
    // isn't shown, so they are shown and then stripped of everything else — no
    // labels (`values` returns nothing, which the label loop simply skips), no
    // ticks, and no reserved space, so the trace still fills the row.
    const style = chartAxisStyle();
    const gridOnly: uPlot.Axis = {
      show: true,
      size: 0,
      gap: 0,
      ticks: {show: false},
      values: () => [],
      stroke: style.stroke,
      grid: {show: true, stroke: style.grid.stroke, width: 1},
    };

    const plot = new uPlot(
      {
        width: container.clientWidth || 300,
        height: HEIGHT,
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
              const at = u.posToVal(left, 'x');
              hoverAtRef.current = at * 1000;
              onScrubRef.current?.(at * 1000);
              setTip({
                ...cursorAnchor(u, container, left, u.cursor.top ?? 0),
                label: formatRef.current(at),
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
            ...gridOnly,
            incrs: (_self, _axisIdx, scaleMin, scaleMax, fullDim) => [
              timeGridStepS(scaleMax - scaleMin, fullDim, X_GRID_SPACE),
            ],
            space: 1,
          },
          // One line per 10 dB, however tight: eight gaps across a row can fall well
          // under any default minimum, and an increment that can't have its minimum
          // spacing is one uPlot refuses to use. So the minimum goes to one pixel —
          // the fixed spacing *is* the point here.
          {...gridOnly, incrs: [DB_GRID_STEP], space: 1},
        ],
        padding: [2, 0, 2, 0],
        // Grid lines land on festival-local boundaries whatever zone the viewer is
        // in, the same as every other chart in the section.
        tzDate: (ts) => zonedDate(ts),
        scales: {
          x: {time: true, range: () => xRange()},
          y: {range: () => [...dbAxis.range]},
        },
        series: [
          {},
          {
            stroke,
            fill: fill(stroke),
            width: 1.25,
            spanGaps: false,
            gaps: makeGapsRefiner(gapThresholdX),
            points: {show: false},
          },
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
      plot.setSize({width: container.clientWidth, height: HEIGHT});
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
  }, [project, xRange, gapThresholdX, stroke, selectable, positionPlayhead]);

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

  // Push data in: once per new trace or mode, and every second while live — which is
  // also what re-runs the x-range closure and slides the live window along.
  // Deliberately not keyed on `range`: the stored trace covers the whole project, so
  // cropping doesn't change a single value.
  useEffect(() => {
    const apply = () => plotRef.current?.setData(project());
    apply();
    if (!live) return;
    const id = setInterval(apply, 1000);
    return () => clearInterval(id);
  }, [project, live, series]);

  // Cropping is a scale change and nothing more, which is the whole point of handing
  // the reduction to uPlot: it re-clips by binary search and redraws, with no data
  // rebuilt on either side. Live's window comes from the tick above instead.
  useEffect(() => {
    if (live) return;
    plotRef.current?.setScale('x', {
      min: range.start / 1000,
      max: range.end / 1000,
    });
  }, [live, range.start, range.end]);

  // Kept out of the effect above, though a crop is one of the two things that moves
  // the line: setScale is not free — uPlot drops the cached paths and clears the
  // canvas whether or not the values differ — and the other thing that moves the line
  // is the playhead itself, which changes on every frame someone hovers any row on the
  // page. Running the two together would redraw every chart per pointer frame, which
  // is the cost the line is drawn in the DOM to avoid.
  useEffect(positionPlayhead, [
    live,
    range.start,
    range.end,
    current,
    positionPlayhead,
  ]);

  return (
    // The plot gets a wrapper of its own so the tooltip has something to be absolute
    // in: uPlot owns every child of its container, and React must not be inserting
    // siblings into a node another library is appending to.
    <Box position="relative" h={`${HEIGHT}px`} w="full">
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
        </ChartTooltip>
      )}
    </Box>
  );
}
