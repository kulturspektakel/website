import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {useTick} from './context';
import {decodeDb, isFresh, type DeviceState, type Weighting} from './noise';
import {formatDb} from './level';
import {
  AXIS_STROKE_VAR,
  GRID_STROKE_VAR,
  cursorAnchor,
  dbAxis,
  plotHeight,
  resolveCssVar,
} from './chartUtils';
import {ChartTooltip} from './ChartTooltip';
import {BAND_FREQUENCIES} from './bluetooth';

// The live 1/3-octave band spectrum: one bar per band at its current level, with
// an optional peak-hold cap line. Driven by its own 1 Hz tick off the device's
// latest record rather than by props, because the record arrives several times a
// second and only the bars need to keep up.

// The 31 IEC band centers (16 Hz … 16 kHz), shared with the calibration dialog
// so the bars line up with the device's band bytes.
const FREQS = BAND_FREQUENCIES;

// Short form for a 31-tick axis rotated −45°, where there is room for "16k" and
// not for "16 kHz". The calibration dialog's slider labels have a whole column
// each and use formatBandFrequency instead.
const fmtHz = (f: number) =>
  f >= 1000 ? `${(f / 1000).toLocaleString('de-DE')}k` : `${f}`;

// Orange for the peak-hold overlay — shared by the chart cap line and the
// tooltip readout so they stay in sync.
const PEAK_COLOR = '#f97316';

// Peak-hold renderer: a short horizontal cap centered on each band at its held
// max, spanning the bar's width (0.85 x-units, matching the Pegel bars). uPlot
// strokes the returned path with the series' stroke color and width.
const peakCaps: uPlot.Series.PathBuilder = (u, sIdx) => {
  const xs = u.data[0];
  const ys = u.data[sIdx];
  const half = Math.abs(u.valToPos(0.425, 'x', true) - u.valToPos(0, 'x', true));
  const stroke = new Path2D();
  for (let i = 0; i < xs.length; i++) {
    const y = ys[i];
    if (y == null || Number.isNaN(y)) continue;
    const cx = u.valToPos(xs[i]!, 'x', true);
    const cy = u.valToPos(y, 'y', true);
    stroke.moveTo(cx - half, cy);
    stroke.lineTo(cx + half, cy);
  }
  return {stroke};
};

export function BandSpectrumChart({
  device,
  state,
  peaks,
  // Not plotted — the spectrum is unweighted. It resets the held peaks, so that
  // switching dB(A)/dB(C) doesn't leave caps from before the switch standing.
  weighting,
}: {
  device: string;
  state: DeviceState | undefined;
  peaks: boolean;
  weighting: Weighting;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const xs = useMemo(() => FREQS.map((_, i) => i), []);
  // Running per-band maximum for the peak-hold overlay. Mutated in place by the
  // 1 Hz tick; NaN entries are bands not yet seen (drawn as no cap). Dropped by
  // the tick when the device goes stale, and reset by the effect below on
  // enable / weighting / device change.
  const peaksRef = useRef<number[]>(new Array(FREQS.length).fill(NaN));
  // Hovered frequency band: which bar (index into FREQS) and where to anchor the
  // tooltip, in container-relative CSS pixels. null when not hovering a bar.
  const [hover, setHover] = useState<{
    idx: number;
    left: number;
    top: number;
  } | null>(null);
  const now = useTick();

  // Read by the tick below without making it a dependency, so the tick always
  // sees the current state without being torn down on every record.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Created once; its data is set by the tick below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const axisStroke = resolveCssVar(AXIS_STROKE_VAR, '#9ca3af');
    const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
    const height = () => plotHeight(container, 240);

    const opts: uPlot.Options = {
      width: container.clientWidth || 800,
      height: height(),
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
        y: {range: () => [...dbAxis.range]},
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
          value: (_u, v) => formatDb(v ?? null, 'dB'),
        },
        {
          // Peak-hold: an orange cap line at each band's running max (see
          // peakCaps). Its visibility follows the `peaks` toggle via setSeries.
          label: 'Peak',
          stroke: PEAK_COLOR,
          width: 2,
          show: false,
          paths: peakCaps,
          points: {show: false},
          value: (_u, v) => formatDb(v ?? null, 'dB'),
        },
      ],
      hooks: {
        setCursor: [
          (u) => {
            const {idx, left, top} = u.cursor;
            if (idx == null || left == null || left < 0 || top == null) {
              setHover(null);
              return;
            }
            setHover({idx, ...cursorAnchor(u, container, left, top)});
          },
        ],
      },
    };

    const plot = new uPlot(
      opts,
      [
        xs,
        new Array(FREQS.length).fill(NaN),
        new Array(FREQS.length).fill(NaN),
      ] as uPlot.AlignedData,
      container,
    );
    plotRef.current = plot;

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: height()});
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [xs]);

  // 1 Hz tick: shows the live spectrum, or empty bars once the device is no
  // longer fresh (ACTIVE_WINDOW_MS; missing vs live).
  useEffect(() => {
    const emptyBands = new Array(FREQS.length).fill(NaN);
    const tick = () => {
      const plot = plotRef.current;
      if (!plot) return;
      const st = stateRef.current;
      const fresh = isFresh(st?.lastSeen, Date.now());
      const ys = fresh
        ? Array.from(st!.latest.bands, (b) => decodeDb(b))
        : emptyBands;
      // Hold the per-band max while the device is live; drop it once stale so
      // the caps don't linger over empty bars.
      const held = peaksRef.current;
      if (fresh) {
        for (let i = 0; i < ys.length; i++) {
          held[i] = Number.isNaN(held[i]) ? ys[i] : Math.max(held[i], ys[i]);
        }
      } else {
        held.fill(NaN);
      }
      plot.setData([xs, ys, held.slice()] as uPlot.AlignedData);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [xs]);

  // Show/hide the peak-hold overlay and clear the held maxima. Resetting on a
  // weighting or device change keeps the caps meaningful — they start fresh from
  // the current spectrum rather than carrying over unrelated peaks.
  useEffect(() => {
    peaksRef.current.fill(NaN);
    plotRef.current?.setSeries(2, {show: peaks});
  }, [peaks, weighting, device]);

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
      {hover && (
        <BandTooltip
          hover={hover}
          state={state}
          now={now}
          peakDb={
            peaks && !Number.isNaN(peaksRef.current[hover.idx])
              ? peaksRef.current[hover.idx]!
              : null
          }
        />
      )}
    </Box>
  );
}

// Floating value readout for the hovered frequency band. The level is read live
// from the device's latest record, or shown as — once the device is no longer
// active.
function BandTooltip({
  hover,
  state,
  now,
  peakDb,
}: {
  hover: {idx: number; left: number; top: number};
  state: DeviceState | undefined;
  now: number;
  // Held peak for the hovered band, or null when the overlay is off / unseen.
  peakDb: number | null;
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
        {formatDb(db, 'dB')}
      </Text>
      {peakDb != null && (
        <Text fontFamily="mono" fontSize="xs" color={PEAK_COLOR} lineHeight="1.2">
          Peak {formatDb(peakDb, 'dB')}
        </Text>
      )}
    </ChartTooltip>
  );
}
