import {useCallback, useEffect, useRef} from 'react';
import {Box} from '@chakra-ui/react';
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
import {
  chartAxisStyle,
  dbAxis,
  makeGapsRefiner,
  timeGridStepS,
  useLatest,
  zonedDate,
} from './chartUtils';

// The level trace behind one device row: a single filled line, no axes, no legend,
// no cursor. Its own plot rather than a configuration of NoiseTimeChart, which is
// built for a full-page chart — nine toggleable series, a tooltip, drag-to-zoom —
// none of which fits (or is wanted) at row height. The styling it does share comes
// from chartUtils, so a row and the detail page read against the same dB scale.
//
// Two sources, one shape, chosen by `live`:
//   live off — the device's whole stored history at one point per minute. uPlot clips
//              it to the x-scale and reduces it to min/max per pixel column itself,
//              so cropping the timeline is a redraw here and no work at all upstream.
//   live on  — the layout's rolling MQTT buffer, re-projected once a second over
//              its last WINDOW_S, so a row moves while you watch it.

// The fast Leq — the same line the device view's chart leads with, so a row and its
// detail page show the same thing at different resolutions. Both weightings draw it
// in the same yellow, so only the buffer column depends on which one is shown.
const STROKE = seriesFor('eq_fast', 'A').stroke;
// The line's own colour at 15 % (8-digit hex is canvas-legal), so the trace reads
// as an area without the line getting lost in it.
const FILL = `${STROKE}26`;
// Fixed, and not chartUtils' plotHeight: that one floors at 100 px for the
// full-page charts, whose containers are flex-sized. dbAxis spans 80 dB, so the
// 10 dB grid below is always eight gaps — at this height ~15 px each, which is
// what makes a level readable off the grid rather than merely suggested by it.
const HEIGHT = 128;
const EMPTY: uPlot.AlignedData = [[], []];

// Horizontal grid every 10 dB, so the trace can be read against a level without
// an axis to label it.
const DB_GRID_STEP = 10;

// Minimum pixels between vertical lines, which is what picks the step off
// timeGridStepS' ladder. Generous, because a row is only a few hundred pixels wide
// and the grid is orientation, not a scale to measure against.
const X_GRID_SPACE = 56;

export function DeviceRowChart({
  device,
  live,
  weighting,
  range,
  series,
}: {
  device: string;
  live: boolean;
  // Which weighting the page is showing. `series` was already resolved for it; this
  // is what picks the matching column out of the live buffer.
  weighting: Weighting;
  // The crop in epoch ms — the x-range when not live, and the only thing a timeline
  // drag changes here.
  range: {start: number; end: number};
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
  // every second anyway, and a new `series` lands with it when not live.
  const colRef = useLatest(bufferColumn('eq_fast', weighting));

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
        cursor: {show: false},
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
            stroke: STROKE,
            fill: FILL,
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

    // Only the width can change: the row gives the trace a fixed height.
    const ro = new ResizeObserver(() =>
      plot.setSize({width: container.clientWidth, height: HEIGHT}),
    );
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
    // The gap refiner is baked into the series at construction, so switching between
    // the live and stored sources rebuilds the plot. Cheap at this size, and it keeps
    // the two from sharing one stale threshold.
  }, [project, xRange, gapThresholdX]);

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

  return (
    <Box ref={containerRef} h={`${HEIGHT}px`} w="full" overflow="hidden" />
  );
}
