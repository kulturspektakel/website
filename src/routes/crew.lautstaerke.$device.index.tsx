import {createFileRoute} from '@tanstack/react-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Flex} from '@chakra-ui/react';
import uPlot from 'uplot';
import {
  GAP_THRESHOLD_S,
  SERIES,
  WINDOW_S,
  decodeDb,
  isFresh,
  useLautstaerkeCtx,
} from '../components/lautstaerke/context';
import {BigNumberRow, useSeriesToggle} from '../components/lautstaerke/BigNumber';
import {NoiseTimeChart} from '../components/lautstaerke/NoiseTimeChart';
import {useDeviceView} from '../components/lautstaerke/deviceView';
import {
  AXIS_STROKE_VAR,
  GRID_STROKE_VAR,
  fmtTime,
  resolveCssVar,
} from '../components/lautstaerke/chartUtils';
import {type NoiseRecording} from '../proto/noise';

export const Route = createFileRoute('/crew/lautstaerke/$device/')({
  component: DeviceLive,
});

const FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000, 20000,
];

const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

function DeviceLive() {
  const {device} = Route.useParams();
  const ctx = useLautstaerkeCtx();
  const {weighting} = useDeviceView();
  const bandRef = useRef<HTMLDivElement | null>(null);
  const bandPlotRef = useRef<uPlot | null>(null);
  const bandXs = useMemo(() => FREQS.map((_, i) => i), []);
  // Chart cursor: null when not hovering (big numbers show live values), a
  // buffer index for the hovered sample, or 'gap' when the cursor sits in a
  // region with no nearby sample (big numbers show — rather than stale data).
  const [cursorIdx, setCursorIdx] = useState<number | 'gap' | null>(null);
  const {shown, toggle} = useSeriesToggle(SERIES);

  if (!ctx.deviceData.current[device]) {
    ctx.deviceData.current[device] = [[], ...SERIES.map(() => [] as number[])];
  }

  const deviceState = ctx.devices[device];
  const latest = deviceState?.latest ?? null;
  // Read by the band tick (below) without making it a dependency, so the tick
  // always sees the current state without being torn down on every record.
  const deviceStateRef = useRef(deviceState);
  deviceStateRef.current = deviceState;

  // Frequency-band chart. Created once; its data is set by the tick below.
  useEffect(() => {
    const container = bandRef.current;
    if (!container) return;
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const canvasHeight = () => Math.max(100, container.clientHeight || 240);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: canvasHeight(),
      legend: {show: false},
      // No hover interaction on the frequency chart — kill the crosshair.
      cursor: {show: false},
      scales: {
        x: {time: false, range: () => [-0.7, FREQS.length - 0.3]},
        y: {range: () => [30, 110]},
      },
      axes: [
        {
          values: (_u, ticks) =>
            ticks.map((t) => {
              const f = FREQS[Math.round(t)];
              return f == null ? '' : fmtHz(f);
            }),
          rotate: -45,
          size: 50,
          space: 28,
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
          label: 'Frequenz',
          value: (_u, v) =>
            v == null ? '' : `${fmtHz(FREQS[Math.round(v)] ?? 0)} Hz`,
        },
        {
          label: 'Pegel',
          stroke: '#fef08a',
          fill: '#fef08a',
          paths: uPlot.paths.bars!({size: [0.85, 60]}),
          points: {show: false},
          value: (_u, v) => (v == null ? '' : `${v.toFixed(1)} dB`),
        },
      ],
    };

    const plot = new uPlot(
      opts,
      [bandXs, new Array(FREQS.length).fill(NaN)] as uPlot.AlignedData,
      container,
    );
    bandPlotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: canvasHeight()});
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      bandPlotRef.current = null;
    };
  }, [bandXs]);

  // 1 Hz tick driving the band chart: shows the live spectrum, or empty bars
  // once the device is no longer fresh (ACTIVE_WINDOW_MS; missing vs live). The
  // time chart manages its own rolling updates internally.
  useEffect(() => {
    const emptyBands = new Array(FREQS.length).fill(NaN);
    const tick = () => {
      const bandPlot = bandPlotRef.current;
      if (!bandPlot) return;
      const st = deviceStateRef.current;
      const ys = isFresh(st?.lastSeen, Date.now())
        ? Array.from(st!.latest.bands, (b) => decodeDb(b))
        : emptyBands;
      bandPlot.setData([bandXs, ys] as uPlot.AlignedData);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [bandXs]);

  // The 5m/30m getters read these off a NoiseRecording; reconstruct a minimal
  // one from the persisted device state so the same getters feed the numbers.
  const decodedLike = {
    laeq5m: deviceState?.laeq5m ?? undefined,
    lceq5m: deviceState?.lceq5m ?? undefined,
    laeq30m: deviceState?.laeq30m ?? undefined,
    lceq30m: deviceState?.lceq30m ?? undefined,
  } as NoiseRecording;
  const data = ctx.deviceData.current[device] as uPlot.AlignedData;

  return (
    <>
      <BigNumberRow
        series={SERIES}
        weighting={weighting}
        shown={shown}
        toggle={toggle}
        cursorIdx={cursorIdx}
        data={data}
        liveValue={(s) => (latest ? s.get(latest, decodedLike) : null)}
      />
      <Flex flex="1" minH="0" direction={{base: 'column', lg: 'row'}} gap="2">
        <NoiseTimeChart
          live
          data={data}
          series={SERIES}
          weighting={weighting}
          shown={shown}
          xRange={() => {
            const max = Date.now() / 1000;
            return [max - WINDOW_S, max];
          }}
          xAxisFormat={fmtTime}
          gapThresholdX={GAP_THRESHOLD_S}
          onCursorIdx={setCursorIdx}
        />
        <Box flex="1" minH="200px" ref={bandRef} overflow="hidden" />
      </Flex>
    </>
  );
}
