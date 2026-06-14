import {createFileRoute} from '@tanstack/react-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Flex, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {
  GAP_THRESHOLD_S,
  SERIES,
  WINDOW_S,
  decodeDb,
  isFresh,
  useLautstaerkeCtx,
  useTick,
  type DeviceState,
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
import {ChartTooltip} from '../components/lautstaerke/ChartTooltip';
import {BAND_FREQUENCIES} from '../components/lautstaerke/bluetooth';

export const Route = createFileRoute('/crew/lautstaerke/$device/')({
  component: DeviceLive,
});

// The 31 IEC 1/3-octave band centers (16 Hz … 16 kHz), shared with the
// calibration dialog so the bars line up with the device's band bytes.
const FREQS = BAND_FREQUENCIES;

const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

function DeviceLive() {
  const {device} = Route.useParams();
  const ctx = useLautstaerkeCtx();
  const {weighting} = useDeviceView();
  const bandRef = useRef<HTMLDivElement | null>(null);
  const bandPlotRef = useRef<uPlot | null>(null);
  const bandXs = useMemo(() => FREQS.map((_, i) => i), []);
  // Hovered frequency band: which bar (index into FREQS) and where to anchor the
  // tooltip, in container-relative CSS pixels. null when not hovering a bar.
  const [bandHover, setBandHover] = useState<{
    idx: number;
    left: number;
    top: number;
  } | null>(null);
  const now = useTick();
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
      // Snap the cursor to the nearest bar so hovering reveals that band's value
      // via the React tooltip below; no crosshair points, no drag-to-zoom.
      cursor: {
        y: false,
        points: {show: false},
        drag: {x: false, y: false},
      },
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
      hooks: {
        setCursor: [
          (u) => {
            const {idx, left, top} = u.cursor;
            if (idx == null || left == null || left < 0 || top == null) {
              setBandHover(null);
              return;
            }
            // u.cursor.left/top are relative to the plotting area; offset by it
            // to anchor the tooltip in container coordinates.
            const over = u.over.getBoundingClientRect();
            const root = container.getBoundingClientRect();
            setBandHover({
              idx,
              left: over.left - root.left + left,
              top: over.top - root.top + top,
            });
          },
        ],
      },
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
        <Box flex="1" minH="200px" position="relative">
          <Box
            position="absolute"
            inset="0"
            ref={bandRef}
            overflow="hidden"
            css={{
              '& .u-cursor-x': {
                borderColor: 'var(--chakra-colors-white)',
              },
            }}
          />
          {bandHover && <BandTooltip hover={bandHover} state={deviceState} now={now} />}
        </Box>
      </Flex>
    </>
  );
}

// Floating value readout for the hovered frequency band. The level is read live
// from the device's latest record (DeviceLive re-renders as records arrive), or
// shown as — once the device is no longer active.
function BandTooltip({
  hover,
  state,
  now,
}: {
  hover: {idx: number; left: number; top: number};
  state: DeviceState | undefined;
  now: number;
}) {
  const band = isFresh(state?.lastSeen, now)
    ? state!.latest.bands[hover.idx]
    : undefined;
  const db = band == null ? null : decodeDb(band);
  return (
    <ChartTooltip left={hover.left} top={hover.top}>
      <Text fontFamily="mono" fontSize="xs" color="gray.400" lineHeight="1.2">
        {fmtHz(FREQS[hover.idx] ?? 0)} Hz
      </Text>
      <Text fontFamily="mono" fontWeight="bold" lineHeight="1.2">
        {db == null ? '—' : `${db.toFixed(1)} dB`}
      </Text>
    </ChartTooltip>
  );
}
