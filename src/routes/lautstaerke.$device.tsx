import {createFileRoute} from '@tanstack/react-router';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, HStack, Heading, Text, VStack} from '@chakra-ui/react';
import uPlot from 'uplot';
import {
  ACTIVE_WINDOW_MS,
  GAP_THRESHOLD_S,
  MqttGate,
  SERIES,
  WINDOW_S,
  decodeDb,
  useLautstaerkeCtx,
} from '../lautstaerke/context';
import {type Record as NoiseRecord} from '../proto/noise';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/lautstaerke/$device')({
  component: DeviceDetail,
  head: ({params}) => seo({title: `Lautstärke – ${params.device}`}),
});

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

type DeviceEvent = CustomEvent<{record: NoiseRecord; receiveTime: number}>;

const FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630,
  800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000, 20000,
];

const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

function BandChart({record}: {record: NoiseRecord | null}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const xs = useMemo(() => FREQS.map((_, i) => i), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: 240,
      legend: {show: false},
      scales: {
        x: {time: false, range: () => [-0.7, FREQS.length - 0.3]},
        y: {range: (_u, _min, max) => [0, Math.max(max + 5, 80)]},
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
        },
        {label: 'dB'},
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
      plot.setSize({width: container.clientWidth, height: 240});
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

  return <Box ref={containerRef} w="full" />;
}

function DeviceDetail() {
  const {device} = Route.useParams();
  const ctx = useLautstaerkeCtx();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const [latest, setLatest] = useState<NoiseRecord | null>(
    ctx.devices[device]?.latest ?? null,
  );

  if (!ctx.deviceData.current[device]) {
    ctx.deviceData.current[device] = [[], ...SERIES.map(() => [] as number[])];
  }

  const lastSeen = ctx.devices[device]?.lastSeen;
  const isFresh =
    latest != null && lastSeen != null && ctx.now - lastSeen < ACTIVE_WINDOW_MS;
  const bandRecord = isFresh ? latest : null;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const data = ctx.deviceData.current[device];

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: 280,
      scales: {
        x: {
          time: true,
          range: () => {
            const max = Date.now() / 1000;
            return [max - WINDOW_S, max];
          },
        },
      },
      axes: [
        {values: (_u, ticks) => ticks.map(fmtTime)},
        {label: 'dB'},
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
          spanGaps: false,
          gaps: gapsRefiner,
          points: {show: false},
        })),
      ],
    };

    const plot = new uPlot(opts, data as uPlot.AlignedData, container);
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: 280});
    });
    ro.observe(container);

    const tick = setInterval(() => {
      plotRef.current?.setData(data as uPlot.AlignedData);
    }, 1000);

    return () => {
      clearInterval(tick);
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [device, ctx.deviceData]);

  useEffect(() => {
    const handler = (evt: Event) => {
      const {record} = (evt as DeviceEvent).detail;
      setLatest(record);
      plotRef.current?.setData(
        ctx.deviceData.current[device] as uPlot.AlignedData,
      );
    };
    ctx.bus.addEventListener(`record:${device}`, handler);
    return () => ctx.bus.removeEventListener(`record:${device}`, handler);
  }, [device, ctx.bus, ctx.deviceData]);

  return (
    <MqttGate>
      <Box>
        <Heading as="h1" size="2xl" mb="4" fontFamily="mono">
          {device}
        </Heading>
      <HStack gap="2" mb="3" align="flex-start" w="full">
        {SERIES.map((s) => (
          <VStack key={s.key} gap="0" align="center" flex="1">
            <Text
              fontSize="2xl"
              fontFamily="mono"
              fontWeight="bold"
              lineHeight="1"
            >
              {latest ? decodeDb(latest[s.key]).toFixed(1) : '—'}
            </Text>
            <Text fontSize="xs" color={s.stroke} fontWeight="bold">
              {s.label}
            </Text>
          </VStack>
        ))}
      </HStack>
      <Box ref={containerRef} w="full" />

        <Box mt="6">
          <BandChart record={bandRecord} />
        </Box>
      </Box>
    </MqttGate>
  );
}
