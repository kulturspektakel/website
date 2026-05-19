import {createFileRoute, Link} from '@tanstack/react-router';
import {LuArrowLeft} from 'react-icons/lu';
import {useEffect, useMemo, useRef} from 'react';
import {
  Box,
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
  decodeDb,
  isFresh,
  useLautstaerkeCtx,
  useTick,
} from '../lautstaerke/context';
import {BatteryChip} from '../lautstaerke/BatteryChip';
import {BluetoothChip} from '../lautstaerke/BluetoothChip';
import {type NoiseRecording_Record as NoiseRecord} from '../proto/noise';
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
const CHART_BOTTOM_RESERVE = 36;

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

const FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000, 20000,
];

const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

function BigNumber({
  value,
  label,
  color,
}: {
  value: number | null;
  label: string;
  color: string;
}) {
  return (
    <VStack gap="1" align="center" flex="1">
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
      Math.max(100, (container.clientHeight || 240) - CHART_BOTTOM_RESERVE);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: canvasHeight(),
      legend: {show: false},
      scales: {
        x: {time: false, range: () => [-0.7, FREQS.length - 0.3]},
        y: {range: () => [40, 110]},
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
          label: 'dB',
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
          stroke: '#2b8cbe',
          fill: '#2b8cbe',
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

  return <Box ref={containerRef} w="full" h="full" />;
}

function DeviceDetail() {
  const {device} = Route.useParams();
  const ctx = useLautstaerkeCtx();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const now = useTick();

  if (!ctx.deviceData.current[device]) {
    ctx.deviceData.current[device] = [[], ...SERIES.map(() => [] as number[])];
  }

  const deviceState = ctx.devices[device];
  const latest = deviceState?.latest ?? null;
  const bandRecord = isFresh(deviceState?.lastSeen, now) ? latest : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const data = ctx.deviceData.current[device];
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const canvasHeight = () =>
      Math.max(100, (container.clientHeight || 280) - CHART_BOTTOM_RESERVE);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: canvasHeight(),
      scales: {
        x: {
          time: true,
          range: () => {
            const max = Date.now() / 1000;
            return [max - WINDOW_S, max];
          },
        },
        y: {range: () => [40, 110]},
      },
      axes: [
        {
          values: (_u, ticks) => ticks.map(fmtTime),
          stroke: axisStroke,
          grid: {stroke: gridStroke},
          ticks: {stroke: gridStroke},
        },
        {
          label: 'dB',
          stroke: axisStroke,
          grid: {stroke: gridStroke},
          ticks: {stroke: gridStroke},
        },
      ],
      series: [
        {
          label: 'Zeit',
          value: (_u, v) => (v == null ? '' : fmtTime(v)),
        },
        ...SERIES.map((s) => ({
          label: s.label,
          stroke: s.stroke,
          width: 1.5,
          dash: 'dash' in s ? (s.dash as unknown as number[]) : undefined,
          spanGaps: false,
          gaps: gapsRefiner,
          points: {show: false},
        })),
      ],
    };

    const plot = new uPlot(opts, data as uPlot.AlignedData, container);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({
        width: container.clientWidth,
        height: canvasHeight(),
      });
    });
    ro.observe(container);

    const handler = () => {
      plotRef.current?.setData(data as uPlot.AlignedData);
    };
    ctx.bus.addEventListener(`record:${device}`, handler);

    return () => {
      ctx.bus.removeEventListener(`record:${device}`, handler);
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [device, ctx.bus, ctx.deviceData]);

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
      </HStack>
      <SimpleGrid columns={6} gap="3" mb="3">
        <BigNumber
          value={latest ? decodeDb(latest.laeq1s) : null}
          label="LAeq,1s"
          color="#2b8cbe"
        />
        <BigNumber
          value={deviceState?.laeq5m != null ? decodeDb(deviceState.laeq5m) : null}
          label="LAeq,5m"
          color="#2b8cbe"
        />
        <BigNumber
          value={deviceState?.laeq30m != null ? decodeDb(deviceState.laeq30m) : null}
          label="LAeq,30m"
          color="#2b8cbe"
        />
        <BigNumber
          value={latest ? decodeDb(latest.lceq1s) : null}
          label="LCeq,1s"
          color="#74a9cf"
        />
        <BigNumber
          value={deviceState?.lceq5m != null ? decodeDb(deviceState.lceq5m) : null}
          label="LCeq,5m"
          color="#74a9cf"
        />
        <BigNumber
          value={deviceState?.lceq30m != null ? decodeDb(deviceState.lceq30m) : null}
          label="LCeq,30m"
          color="#74a9cf"
        />
      </SimpleGrid>
      <Flex
        flex="1"
        minH="0"
        direction={{base: 'column', lg: 'row'}}
        gap="4"
      >
        <Box
          flex="1"
          minH="200px"
          ref={containerRef}
          overflow="hidden"
          css={{
            '& .u-legend': {
              fontSize: '11px',
              color: 'var(--chakra-colors-gray-300)',
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
