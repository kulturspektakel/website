import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Box, Button, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {
  AXIS_STROKE_VAR,
  GRID_STROKE_VAR,
  zonedDate,
  makeGapsRefiner,
  resolveCssVar,
  seriesKind,
} from './chartUtils';
import {type Weighting} from './context';
import {ChartTooltip} from './ChartTooltip';

// Shared time-series chart for both the live and historical noise pages. The
// big-number row above each page doubles as the legend, so uPlot's own is off.
//
// Live mode (`live`): the data lives in a mutable ref outside React and is
// re-projected onto the rolling window once per second. Historical mode: the
// data is static and set once (re-set when `dataVersion` changes, e.g. the day).
export function NoiseTimeChart({
  data,
  series,
  weighting,
  shown,
  xRange,
  xAxisFormat,
  gapThresholdX,
  live,
  zoomable,
  zoomResetKey,
  onCursorIdx,
}: {
  // [xEpochSeconds[], ...one column per entry in `series`, in order]. In live
  // mode this is the mutable rolling buffer (read fresh on each 1 Hz tick); in
  // historical mode a static array re-pushed whenever its identity changes.
  data: uPlot.AlignedData;
  series: ReadonlyArray<{
    label: string;
    weighting: Weighting;
    stroke: string;
    hidden?: boolean;
  }>;
  weighting: Weighting;
  // Keyed by seriesKind; mirrors the big-number legend toggles.
  shown: Record<string, boolean>;
  xRange: () => [number, number];
  xAxisFormat: (ts: number) => string;
  gapThresholdX: number;
  live?: boolean;
  // Enables drag-to-zoom on the x-axis (historical view only). The rolling live
  // window would fight an active zoom, so live callers leave this off.
  zoomable?: boolean;
  // Changing this clears any active zoom — it marks a genuinely different
  // dataset (e.g. another day). Kept separate from `data` identity so a same-day
  // refetch can push newly-arrived samples without resetting the user's zoom.
  zoomResetKey?: unknown;
  onCursorIdx: (idx: number | 'gap' | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  // Hovered time readout: where to anchor the tooltip (container-relative CSS
  // pixels) and the formatted time under the cursor. null when not hovering.
  const [tip, setTip] = useState<{left: number; top: number; label: string} | null>(
    null,
  );

  // Read by the long-lived plot closures (range/axis/cursor) and the 1 Hz tick
  // without making them effect dependencies, so the plot isn't torn down when
  // the buffer mutates or props change identity.
  const dataRef = useRef(data);
  dataRef.current = data;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const xRangeRef = useRef(xRange);
  xRangeRef.current = xRange;
  const xAxisFormatRef = useRef(xAxisFormat);
  xAxisFormatRef.current = xAxisFormat;
  const onCursorRef = useRef(onCursorIdx);
  onCursorRef.current = onCursorIdx;

  // Active zoom x-window (epoch seconds), or null for the full/default range.
  // Read by the long-lived x-scale range closure so a zoom survives redraws and
  // resizes; `zoomed` mirrors it into React state to toggle the reset button.
  const zoomRef = useRef<[number, number] | null>(null);
  const [zoomed, setZoomed] = useState(false);

  const resetZoom = useCallback(() => {
    const plot = plotRef.current;
    if (!plot || !zoomRef.current) return;
    zoomRef.current = null;
    setZoomed(false);
    const [min, max] = xRangeRef.current();
    plot.setScale('x', {min, max});
  }, []);

  // Only the selected weighting's series are plotted. The buffer always carries
  // every column, so project it down to [time, ...visible].
  const visible = useMemo(
    () =>
      series
        .map((s, i) => ({s, col: i + 1}))
        .filter(({s}) => s.weighting === weighting),
    [series, weighting],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const project = () => {
      const full = dataRef.current;
      return [full[0], ...visible.map(({col}) => full[col])] as uPlot.AlignedData;
    };
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const canvasHeight = () => Math.max(100, container.clientHeight || 280);
    const gaps = makeGapsRefiner(gapThresholdX);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: canvasHeight(),
      legend: {show: false},
      // Only the vertical guide line — no horizontal line, no snapped points.
      // When zoomable, allow an x-only drag selection but capture it ourselves
      // (setScale:false) via the setSelect hook rather than letting uPlot zoom
      // through the range fn, which we keep authoritative.
      cursor: {
        y: false,
        points: {show: false},
        drag: zoomable
          ? {x: true, y: false, setScale: false}
          : {x: false, y: false},
      },
      // Place time ticks on `timeZone` boundaries, independent of viewer TZ.
      tzDate: (ts) => zonedDate(ts),
      scales: {
        // An active zoom wins over the default range, and survives redraws
        // because uPlot re-invokes this on every non-explicit rescale.
        x: {time: true, range: () => zoomRef.current ?? xRangeRef.current()},
        y: {range: () => [30, 110]},
      },
      axes: [
        {
          values: (_u, ticks) => ticks.map((t) => xAxisFormatRef.current(t)),
          stroke: axisStroke,
          grid: {stroke: gridStroke},
          ticks: {stroke: gridStroke},
        },
        {
          stroke: axisStroke,
          grid: {stroke: gridStroke},
          ticks: {stroke: gridStroke},
        },
      ],
      series: [
        {
          label: 'Zeit',
          value: (_u, v) =>
            v == null ? '--:--:--' : xAxisFormatRef.current(v),
        },
        ...visible.map(({s}) => ({
          label: s.label,
          stroke: s.stroke,
          show: shownRef.current[seriesKind(s.label)],
          width: 1.5,
          spanGaps: false,
          gaps,
          points: {show: false},
        })),
      ],
      hooks: {
        setCursor: [
          (u) => {
            // Drive the big numbers off the hovered sample; null when the
            // cursor leaves the plot. uPlot snaps idx to the nearest sample even
            // across a gap, so flag 'gap' when that sample is further away than
            // the gap threshold.
            const idx = u.cursor.idx;
            const {left, top} = u.cursor;
            let next: number | 'gap' | null;
            if (idx == null) {
              next = null;
            } else {
              const dataX = u.data[0][idx] as number | undefined;
              const cursorX = u.posToVal(u.cursor.left ?? -1, 'x');
              next =
                dataX == null || Math.abs(cursorX - dataX) > gapThresholdX
                  ? 'gap'
                  : idx;
            }
            onCursorRef.current(next);

            // Time tooltip, anchored to the vertical line at the mouse x.
            if (idx == null || left == null || left < 0 || top == null) {
              setTip(null);
            } else {
              const over = u.over.getBoundingClientRect();
              const root = container.getBoundingClientRect();
              setTip({
                left: over.left - root.left + left,
                top: over.top - root.top + top,
                label: xAxisFormatRef.current(u.posToVal(left, 'x')),
              });
            }
          },
        ],
        // Fires once on drag release (only when a real selection exists). Turn
        // the dragged pixel region into an x-value window and apply it as the
        // active zoom, then clear the rubber band without re-firing the hook.
        setSelect: [
          (u) => {
            if (!zoomable) return;
            const {left, width} = u.select;
            if (width < 8) {
              u.setSelect({left: 0, top: 0, width: 0, height: 0}, false);
              return;
            }
            const min = u.posToVal(left, 'x');
            const max = u.posToVal(left + width, 'x');
            zoomRef.current = [min, max];
            setZoomed(true);
            u.setScale('x', {min, max});
            u.setSelect({left: 0, top: 0, width: 0, height: 0}, false);
          },
        ],
      },
    };

    const plot = new uPlot(opts, project(), container);
    plotRef.current = plot;

    // uPlot's mouse drag-to-select zoom doesn't fire on touch, so give touch
    // devices a one-finger pan / two-finger pinch on the x-axis instead (adapted
    // from uPlot's zoom-touch demo, x-only). We drive it through the same
    // `zoomRef` the mouse selection uses, so a touch zoom survives redraws and
    // the reset button appears. Scoped to zoomable (historical view); the live
    // view keeps normal page scrolling. touch-action:none stops the browser from
    // claiming the gesture for scroll.
    let removeTouch: (() => void) | undefined;
    if (zoomable) {
      const over = plot.over;
      over.style.touchAction = 'none';

      // Finger midpoint x (px, relative to the plot) and spread `d` between the
      // two fingers (1 for a single finger, so xFactor stays 1 → pure pan).
      const fr = {x: 0, d: 1};
      const to = {x: 0, d: 1};
      let rect = over.getBoundingClientRect();
      let oxRange = 0;
      let xVal = 0;

      const storePos = (t: {x: number; d: number}, e: TouchEvent) => {
        const t0 = e.touches[0];
        const t0x = t0.clientX - rect.left;
        if (e.touches.length === 1) {
          t.x = t0x;
          t.d = 1;
        } else {
          const t1x = e.touches[1].clientX - rect.left;
          t.x = (t0x + t1x) / 2;
          t.d = Math.max(Math.abs(t1x - t0x), 1);
        }
      };

      let rafPending = false;
      const applyZoom = () => {
        rafPending = false;
        const xFactor = fr.d / to.d;
        const leftPct = to.x / rect.width;
        const nxRange = oxRange * xFactor;
        const nxMin = xVal - leftPct * nxRange;
        const nxMax = nxMin + nxRange;
        zoomRef.current = [nxMin, nxMax];
        setZoomed(true);
        plot.setScale('x', {min: nxMin, max: nxMax});
      };

      const onMove = (e: TouchEvent) => {
        e.preventDefault();
        storePos(to, e);
        if (!rafPending) {
          rafPending = true;
          requestAnimationFrame(applyZoom);
        }
      };
      // Fires again when a second finger lands, so re-anchor to the current
      // scale and finger positions — avoids a jump when pan turns into pinch.
      // preventDefault stops the browser's compatibility mouse events, which
      // would otherwise trigger uPlot's own drag-select and zoom to an empty
      // region when the touch ends.
      const onStart = (e: TouchEvent) => {
        e.preventDefault();
        rect = over.getBoundingClientRect();
        storePos(fr, e);
        const {min, max} = plot.scales.x;
        oxRange = (max ?? 0) - (min ?? 0);
        xVal = plot.posToVal(fr.x, 'x');
      };

      over.addEventListener('touchstart', onStart, {passive: false});
      over.addEventListener('touchmove', onMove, {passive: false});
      removeTouch = () => {
        over.removeEventListener('touchstart', onStart);
        over.removeEventListener('touchmove', onMove);
      };
    }

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: canvasHeight()});
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      removeTouch?.();
      plot.destroy();
      plotRef.current = null;
    };
  }, [visible, gapThresholdX, zoomable]);

  // A new dataset (e.g. a different day) invalidates any active zoom — clear it
  // so the new range opens at full extent. Keyed on `zoomResetKey`, not `data`:
  // a weighting toggle or a same-day refetch keeps the key and so keeps the zoom.
  useEffect(() => {
    resetZoom();
  }, [zoomResetKey, resetZoom]);

  // Push data into the plot. Historical: once, and again whenever `data`
  // changes identity (e.g. a new day). Live: re-project the rolling buffer
  // every second (its identity is stable, so the effect just sets the interval).
  useEffect(() => {
    const apply = () => {
      const plot = plotRef.current;
      if (!plot) return;
      const full = dataRef.current;
      plot.setData([
        full[0],
        ...visible.map(({col}) => full[col]),
      ] as uPlot.AlignedData);
    };
    apply();
    if (!live) return;
    const id = setInterval(apply, 1000);
    return () => clearInterval(id);
  }, [visible, live, data]);

  // Push show/hide toggles into the chart without rebuilding the plot.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    visible.forEach(({s}, vi) =>
      plot.setSeries(vi + 1, {show: shown[seriesKind(s.label)]}),
    );
  }, [shown, visible]);

  return (
    <Box flex="1" minH="200px" position="relative">
      <Box
        position="absolute"
        inset="0"
        ref={containerRef}
        overflow="hidden"
        css={{
          '& .u-cursor-x': {
            borderColor: 'var(--chakra-colors-white)',
          },
          // Translucent light fill so the drag region reads on the dark chart.
          '& .u-select': {
            background: 'rgba(255, 255, 255, 0.15)',
          },
        }}
      />
      {tip && (
        <ChartTooltip left={tip.left} top={tip.top}>
          <Text fontFamily="mono" fontSize="xs" lineHeight="1.2">
            {tip.label}
          </Text>
        </ChartTooltip>
      )}
      {zoomed && (
        <Button
          position="absolute"
          top="2"
          right="2"
          size="xs"
          variant="subtle"
          colorPalette="gray"
          onClick={resetZoom}
        >
          Zoom zurücksetzen
        </Button>
      )}
    </Box>
  );
}
