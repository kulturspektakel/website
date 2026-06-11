import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text} from '@chakra-ui/react';
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
      cursor: {y: false, points: {show: false}},
      // Place time ticks on `timeZone` boundaries, independent of viewer TZ.
      tzDate: (ts) => zonedDate(ts),
      scales: {
        x: {time: true, range: () => xRangeRef.current()},
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
      },
    };

    const plot = new uPlot(opts, project(), container);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: canvasHeight()});
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [visible, gapThresholdX]);

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
        }}
      />
      {tip && (
        <ChartTooltip left={tip.left} top={tip.top}>
          <Text fontFamily="mono" fontSize="xs" lineHeight="1.2">
            {tip.label}
          </Text>
        </ChartTooltip>
      )}
    </Box>
  );
}
