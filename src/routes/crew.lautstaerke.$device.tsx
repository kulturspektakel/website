import {createFileRoute, Link} from '@tanstack/react-router';
import {LuArrowLeft} from 'react-icons/lu';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  IconButton,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import uPlot from 'uplot';
import {
  GAP_THRESHOLD_S,
  SERIES,
  WINDOW_S,
  type Weighting,
  decodeDb,
  isFresh,
  useLautstaerkeCtx,
  useTick,
} from '../components/lautstaerke/context';
import {BatteryChip} from '../components/lautstaerke/BatteryChip';
import {BluetoothChip} from '../components/lautstaerke/BluetoothChip';
import {
  type NoiseRecording,
  type NoiseRecording_Record as NoiseRecord,
} from '../proto/noise';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/crew/lautstaerke/$device')({
  component: DeviceDetail,
  head: ({params}) => seo({title: `Lautstärke – ${params.device}`}),
});

// Canvas 2D rejects `var(...)` strings, so resolve Chakra CSS variables to
// concrete colors at mount time before handing them to uPlot.
const resolveCssVar = (cssVar: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const m = cssVar.match(/^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/);
  if (!m) return cssVar;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(m[1])
    .trim();
  return v || m[2]?.trim() || fallback;
};

const AXIS_STROKE_VAR = 'var(--chakra-colors-gray-400)';
const GRID_STROKE_VAR = 'var(--chakra-colors-gray-700)';

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtTime = (ts: number) => {
  const d = new Date(ts * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const gapsRefiner: uPlot.Series.GapsRefiner = (u, _sIdx, i0, i1, nullGaps) => {
  const xs = u.data[0];
  const out = nullGaps.slice();
  for (let i = i0; i < i1; i++) {
    if ((xs[i + 1] as number) - (xs[i] as number) > GAP_THRESHOLD_S) {
      out.push([
        Math.round(u.valToPos(xs[i] as number, 'x', true)),
        Math.round(u.valToPos(xs[i + 1] as number, 'x', true)),
      ]);
    }
  }
  return out;
};

// Weighting-independent identity of a series ('LAeq,1s' -> 'Leq,1s'), so the
// legend toggle state can be shared across the dB(A)/dB(C) switch.
const seriesKind = (label: string) => label[0] + label.slice(2);

const FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000, 20000,
];

const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

// Doubles as the chart legend: shows the value (live, or at the cursor while
// hovering) and toggles the matching chart line on click. Dimmed when hidden.
function BigNumber({
  value,
  label,
  color,
  enabled,
  onClick,
}: {
  value: number | null;
  label: string;
  color: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <VStack
      gap="1"
      align="center"
      flex="1"
      minW="0"
      role="button"
      onClick={onClick}
      opacity={enabled ? 1 : 0.2}
      cursor="pointer"
      userSelect="none"
      transition="opacity 0.15s"
      _hover={{opacity: enabled ? 0.8 : 0.4}}
    >
      <Text
        fontSize={{base: 'clamp(1rem, 7vw, 2rem)', lg: 'clamp(2rem, 6vw, 4rem)'}}
        fontFamily="mono"
        fontWeight="bold"
        lineHeight="1"
      >
        {value == null ? '—' : value.toFixed(1)}
      </Text>
      <Text fontSize="sm" color={color} fontWeight="bold">
        {label}
      </Text>
    </VStack>
  );
}

function BandChart({record}: {record: NoiseRecord | null}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const xs = useMemo(() => FREQS.map((_, i) => i), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const canvasHeight = () =>
      Math.max(100, container.clientHeight || 240);

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
          value: (_u, v) => (v == null ? '' : `${fmtHz(FREQS[Math.round(v)] ?? 0)} Hz`),
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
      [xs, new Array(FREQS.length).fill(NaN)] as uPlot.AlignedData,
      container,
    );
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({
        width: container.clientWidth,
        height: canvasHeight(),
      });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [xs]);

  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const ys = record
      ? Array.from(record.bands, (b) => decodeDb(b))
      : new Array(FREQS.length).fill(NaN);
    plot.setData([xs, ys] as uPlot.AlignedData);
  }, [record, xs]);

  return (
    <Box ref={containerRef} w="full" h="full" />
  );
}

function DeviceDetail() {
  const {device} = Route.useParams();
  const ctx = useLautstaerkeCtx();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const now = useTick();
  const [weighting, setWeighting] = useState<Weighting>('A');
  // Chart cursor: null when not hovering (big numbers show live values), a
  // buffer index for the hovered sample, or 'gap' when the cursor sits in a
  // region with no nearby sample (big numbers show — rather than stale data).
  const [cursorIdx, setCursorIdx] = useState<number | 'gap' | null>(null);
  // Visibility keyed by weighting-independent series kind, kept in sync with
  // the chart legend so the big numbers mirror exactly what's plotted and the
  // toggle state carries across the dB(A)/dB(C) switch.
  const [shown, setShown] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const s of SERIES) m[seriesKind(s.label)] = !('hidden' in s && s.hidden);
    return m;
  });
  const shownRef = useRef(shown);
  shownRef.current = shown;

  if (!ctx.deviceData.current[device]) {
    ctx.deviceData.current[device] = [[], ...SERIES.map(() => [] as number[])];
  }

  const deviceState = ctx.devices[device];
  const latest = deviceState?.latest ?? null;
  const bandRecord = isFresh(deviceState?.lastSeen, now) ? latest : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const fullData = ctx.deviceData.current[device];
    // Only the selected weighting's series are plotted. The buffer always
    // carries every column, so project it down to [time, ...visible].
    const visible = SERIES.map((s, i) => ({s, col: i + 1})).filter(
      ({s}) => s.weighting === weighting,
    );
    const project = () =>
      [fullData[0], ...visible.map(({col}) => fullData[col])] as uPlot.AlignedData;
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const canvasHeight = () =>
      Math.max(100, container.clientHeight || 280);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: canvasHeight(),
      // The big-number row above doubles as the legend, so hide uPlot's own.
      legend: {show: false},
      scales: {
        x: {
          time: true,
          range: () => {
            const max = Date.now() / 1000;
            return [max - WINDOW_S, max];
          },
        },
        y: {range: () => [30, 110]},
      },
      axes: [
        {
          values: (_u, ticks) => ticks.map(fmtTime),
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
          value: (_u, v) => (v == null ? '--:--:--' : fmtTime(v)),
        },
        ...visible.map(({s}) => ({
          label: s.label,
          stroke: s.stroke,
          show: shownRef.current[seriesKind(s.label)],
          width: 1.5,
          spanGaps: false,
          gaps: gapsRefiner,
          points: {show: false},
        })),
      ],
      hooks: {
        setCursor: [
          (u) => {
            // Drive the big numbers off the hovered sample; null when the
            // cursor leaves the plot so they fall back to live values. uPlot
            // snaps idx to the nearest sample even across a gap, so flag a
            // 'gap' when that sample is further away than the gap threshold.
            const idx = u.cursor.idx;
            let next: number | 'gap' | null;
            if (idx == null) {
              next = null;
            } else {
              const dataX = u.data[0][idx] as number | undefined;
              const cursorX = u.posToVal(u.cursor.left ?? -1, 'x');
              next =
                dataX == null || Math.abs(cursorX - dataX) > GAP_THRESHOLD_S
                  ? 'gap'
                  : idx;
            }
            setCursorIdx((prev) => (prev === next ? prev : next));
          },
        ],
      },
    };

    const plot = new uPlot(opts, project(), container);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({
        width: container.clientWidth,
        height: canvasHeight(),
      });
    });
    ro.observe(container);

    const handler = () => {
      plotRef.current?.setData(project());
    };
    ctx.bus.addEventListener(`record:${device}`, handler);

    return () => {
      ctx.bus.removeEventListener(`record:${device}`, handler);
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [device, ctx.bus, ctx.deviceData, weighting]);

  // Push big-number show/hide toggles into the chart. Kept separate from plot
  // creation so toggling a series doesn't tear down and rebuild the whole plot.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    SERIES.map((s, i) => ({s, i}))
      .filter(({s}) => s.weighting === weighting)
      .forEach(({s}, vi) => plot.setSeries(vi + 1, {show: shown[seriesKind(s.label)]}));
  }, [shown, weighting]);

  // The 5m/30m getters read these off a NoiseRecording; reconstruct a minimal
  // one from the persisted device state so the same getters feed the numbers.
  const decodedLike = {
    laeq5m: deviceState?.laeq5m ?? undefined,
    lceq5m: deviceState?.lceq5m ?? undefined,
    laeq30m: deviceState?.laeq30m ?? undefined,
    lceq30m: deviceState?.lceq30m ?? undefined,
  } as NoiseRecording;
  // All metrics for the current weighting are always shown. While hovering, the
  // value comes from the buffered sample under the cursor (column i+1 mirrors
  // SERIES[i]); otherwise it's the live latest reading.
  const fullData = ctx.deviceData.current[device];
  const bigNumbers = SERIES.map((s, i) => ({s, i}))
    .filter(({s}) => s.weighting === weighting)
    .map(({s, i}) => {
      const k = seriesKind(s.label);
      const value =
        cursorIdx === 'gap'
          ? null
          : cursorIdx != null
            ? ((fullData[i + 1]?.[cursorIdx] ?? null) as number | null)
            : latest
              ? s.get(latest, decodedLike)
              : null;
      return {kind: k, label: s.label, color: s.stroke, value, enabled: shown[k]};
    });

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      <HStack mb="4" align="center">
        <IconButton
          asChild
          aria-label="Zurück zur Geräteliste"
          variant="ghost"
          size="sm"
        >
          <Link to="/crew/lautstaerke">
            <LuArrowLeft />
          </Link>
        </IconButton>
        <VStack align="start" gap="0" flex="1" minW="0">
          {ctx.deviceLocations[device] && (
            <Heading as="h1" size="2xl" truncate w="full">
              {ctx.deviceLocations[device]}
            </Heading>
          )}
          <HStack gap="2">
            {ctx.deviceLocations[device] ? (
              <Text
                fontFamily="mono"
                fontSize="sm"
                color="gray.500"
                truncate
                minW="0"
              >
                {device}
              </Text>
            ) : (
              <Heading
                as="h1"
                size="2xl"
                fontFamily="mono"
                truncate
                minW="0"
              >
                {device}
              </Heading>
            )}
            {deviceState?.batteryMv != null && (
              <BatteryChip mv={deviceState.batteryMv} />
            )}
          </HStack>
        </VStack>
        {ctx.bluetooth.deviceName === device && <BluetoothChip />}
        <Button
          size="sm"
          flexShrink="0"
          variant="outline"
          fontFamily="mono"
          minW="20"
          onClick={() => setWeighting((w) => (w === 'A' ? 'C' : 'A'))}
        >
          {weighting === 'A' ? 'dB(A)' : 'dB(C)'}
        </Button>
      </HStack>
      <SimpleGrid columns={bigNumbers.length || 1} gap="3" mb="3">
        {bigNumbers.map((n) => (
          <BigNumber
            key={n.label}
            value={n.value}
            label={n.label}
            color={n.color}
            enabled={n.enabled}
            onClick={() =>
              setShown((prev) => ({...prev, [n.kind]: !prev[n.kind]}))
            }
          />
        ))}
      </SimpleGrid>
      <Flex
        flex="1"
        minH="0"
        direction={{base: 'column', lg: 'row'}}
        gap="2"
      >
        <Box
          flex="1"
          minH="200px"
          ref={containerRef}
          overflow="hidden"
          css={{
            '& .u-cursor-x, & .u-cursor-y': {
              borderColor: 'var(--chakra-colors-white)',
            },
          }}
        />
        <Box flex="1" minH="200px">
          <BandChart record={bandRecord} />
        </Box>
      </Flex>
    </Box>
  );
}
