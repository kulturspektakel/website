import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {useTick} from './context';
import {decodeDb, isFresh, type DeviceState} from './noise';
import {formatDb, formatDeltaDb} from './level';
import {
  bandAxis,
  bandRange,
  CHART_PADDING,
  cursorAnchor,
  dbAxis,
  dbLevelAxis,
  fmtHz,
  MIN_PLOT_HEIGHT,
  plotHeight,
} from './chartUtils';
import {themeHex} from '../../theme-noise';
import {ChartTooltip} from './ChartTooltip';
import {BAND_FREQUENCIES} from './bluetooth';
import {useDeviceView} from './deviceView';

// The live 1/3-octave band spectrum: one bar per band at its current level, and — while a
// reference microphone is open in its panel — the same spectrum as that microphone hears
// it, over the top. Driven by the shared 1 Hz clock rather than by props, because the
// record arrives several times a second and only the bars need to keep up.
//
// One clock for both, which matters more here than it looks: that tick is also what bounds
// the microphone's own average, so the two lines are always the same second. Two clocks a
// few hundred milliseconds apart would put a monitor's now beside a microphone's a moment
// ago, and the difference the reader is here to read would be off by however much the room
// moved in between.

// The reference line's column in the plot's data, and its series index — the same number,
// since series 0 is the x scale.
const REF = 2;

// A fresh array each time rather than one hoisted constant: uPlot holds on to the arrays it
// is handed, so a shared one would be a buffer two plots and one tick all believe they own.
const emptyBars = () => new Array<number>(FREQS.length).fill(NaN);
const emptyRef = () => new Array<number | null>(FREQS.length).fill(null);

// The 31 IEC band centers (16 Hz … 16 kHz), shared with the calibration dialog
// so the bars line up with the device's band bytes.
const FREQS = BAND_FREQUENCIES;

// The frequency axis, the short form of a band centre, and the x range they are drawn against
// all live in chartUtils now: the calibration result chart is a second chart of these same 31
// bands, and the two are read against each other. The trace beside this one keeps its labels
// flat; the turned ones are for the axis with more to say than it has width.

// uPlot's own crosshair, which this chart keeps — unlike the trace, whose line marks an
// instant the whole page shares and so is drawn as DOM. Restyled to match that line all
// the same: the library's stylesheet draws it dashed, and the two answer the same pointer
// a few hundred pixels apart. Hoisted rather than inlined on the Box, so Emotion hashes it
// once for the session instead of re-serializing it every render.
const CHART_CSS = {
  '& .u-cursor-x': {
    borderColor: 'chart.playhead',
    borderRightStyle: 'solid',
  },
} as const;

export function BandSpectrumChart({state}: {state: DeviceState | undefined}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);
  const xs = useMemo(() => FREQS.map((_, i) => i), []);
  // Hovered frequency band: which bar (index into FREQS) and where to anchor the
  // tooltip, in container-relative CSS pixels. null when not hovering a bar.
  const [hover, setHover] = useState<{
    idx: number;
    left: number;
    top: number;
  } | null>(null);
  const now = useTick();
  const {referenceMic} = useDeviceView();
  const measuring = referenceMic.selected != null;
  // The reference's last second, mirrored into state for the readout. The plot is handed
  // it imperatively like everything else here; this copy exists because a tooltip cannot
  // read a ref and stay right.
  const [refBands, setRefBands] = useState<(number | null)[] | null>(null);

  // Read by the tick below without making it a dependency, so the tick always
  // sees the current state without being torn down on every record.
  const stateRef = useRef(state);
  stateRef.current = state;
  // Stable for the hook's life (a useCallback with no deps), so unlike stateRef above this
  // one can simply be a dependency of the tick effect.
  const {drain, observeSecond} = referenceMic;

  // Created once; its data is set by the tick below.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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
        x: {time: false, range: () => bandRange(FREQS.length)},
        y: {range: () => [...dbAxis.range]},
      },
      axes: [
        bandAxis(FREQS),
        // The same dB axis the trace draws, off the same range — which is the point of
        // sharing it: the two sit side by side on the live view, and a level read off one
        // has to fall on the same line as the same level read off the other.
        dbLevelAxis(),
      ],
      // The gutters above reserve the left and the bottom; this keeps the tallest bar off
      // the top edge and the last label off the right one, at the same two values the
      // trace uses so the two plot areas come out identical.
      padding: CHART_PADDING,
      series: [
        {
          label: 'Frequency',
          value: (_u, v) =>
            v == null ? '' : `${fmtHz(FREQS[Math.round(v)] ?? 0)} Hz`,
        },
        {
          label: 'Level',
          stroke: themeHex('chart.band.bar'),
          fill: themeHex('chart.band.bar'),
          paths: uPlot.paths.bars!({size: [0.85, 60]}),
          points: {show: false},
          value: (_u, v) => formatDb(v ?? null, 'dB'),
        },
        // The reference microphone, as a line over the bars rather than a second set of
        // them: 62 bars is a fence at the widths this chart gets on a phone, and a line
        // over a filled bar reads as two readings of one band rather than two bands.
        // Declared last so it draws last, uPlot taking its series in order. Starts hidden
        // whatever the current selection: the effect below runs in the same flush, so
        // visibility is settled before any paint — and the initial column is all nulls, so a
        // series shown too early would draw nothing anyway.
        {
          label: 'Reference',
          stroke: themeHex('chart.band.ref'),
          width: 2,
          points: {show: false},
          show: false,
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
      [xs, emptyBars(), emptyRef()] as uPlot.AlignedData,
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

  // Every second: the monitor's latest spectrum, or empty bars once it is no longer fresh
  // (ACTIVE_WINDOW_MS; missing vs live), and the reference microphone's second alongside.
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const st = stateRef.current;
    const live = isFresh(st?.lastSeen, Date.now())
      ? Array.from(st!.latest.bands, (b) => decodeDb(b))
      : null;
    // Null rather than NaN, and not interchangeably: uPlot tests for null to find a gap,
    // and a NaN reaches the canvas instead, where a non-finite lineTo is dropped and the
    // line is drawn straight *across* the hole it was supposed to leave. The bars get away
    // with NaN above only because a bar is drawn per point.
    const reference = drain();
    setRefBands(reference);
    plot.setData([xs, live ?? emptyBars(), reference ?? emptyRef()] as uPlot.AlignedData); // prettier-ignore
    // Both instruments' second, to whatever is measuring one against the other. Handed over
    // from here rather than sampled there, and this is the only place it could be: drain()
    // *empties* the microphone's accumulator, so a second consumer on its own clock would take
    // frames this chart never sees and pair them with a monitor's record from a different
    // moment. Which is the same reason this chart has one clock for both (see the note at the
    // top) — a calibration run is that argument again, over thirty seconds instead of one.
    //
    // In its own shape, not the plot's: null for an absent reading rather than a column of
    // NaN, and the record's own timestamp, so the run can tell a monitor that has stopped
    // reporting from one whose record has simply not advanced yet.
    observeSecond(live, reference, st?.lastSeen ?? null);
  }, [now, xs, drain, observeSecond]);

  // Visibility is a series property rather than an absence of data, because uPlot cannot be
  // given a series after it is built. Its own effect, so picking a microphone does not
  // rebuild the plot.
  useEffect(() => {
    plotRef.current?.setSeries(REF, {show: measuring});
  }, [measuring, xs]);

  return (
    <Box flex="1" minH={`${MIN_PLOT_HEIGHT}px`} position="relative">
      <Box
        position="absolute"
        inset="0"
        ref={containerRef}
        overflow="hidden"
        css={CHART_CSS}
      />
      {hover && (
        <BandTooltip
          hover={hover}
          state={state}
          now={now}
          reference={refBands}
          showReference={measuring}
        />
      )}
    </Box>
  );
}

// Floating value readout for the hovered frequency band. The level is read live from the
// device's latest record, or shown as — once the device is no longer active.
//
// With a reference microphone it becomes the whole reading, because the chart has no legend
// and the gap between the two is the point: which band, what each instrument says it is,
// and how far apart they are. The difference is this second's, like both levels above it —
// nothing here averages over a longer run, so it moves about with the signal and is read as
// an indication rather than as a figure to write down.
function BandTooltip({
  hover,
  state,
  now,
  reference,
  showReference,
}: {
  hover: {idx: number; left: number; top: number};
  state: DeviceState | undefined;
  now: number;
  // The microphone's latest second. Null both when no microphone is open and when one is
  // but produced no frame — a backgrounded tab — which read the same way here.
  reference: (number | null)[] | null;
  // Whether to draw the extra rows at all, which is a different question: an open
  // microphone with nothing to show still owes the reader a dash rather than silence.
  showReference: boolean;
}) {
  const band = isFresh(state?.lastSeen, now)
    ? state!.latest.bands[hover.idx]
    : undefined;
  const db = band == null ? null : decodeDb(band);
  const ref = reference?.[hover.idx] ?? null;
  return (
    <ChartTooltip left={hover.left} top={hover.top}>
      <Text fontSize="xs" color="fg.muted" lineHeight="1.2">
        {fmtHz(FREQS[hover.idx] ?? 0)} Hz
      </Text>
      {/* Alone, the level keeps the weight it always had. Beside a second one it needs a
          colour instead, since the only thing saying which line is which is here. */}
      {!showReference ? (
        <Text fontWeight="bold" lineHeight="1.2">
          {formatDb(db, 'dB')}
        </Text>
      ) : (
        <>
          <Text fontWeight="bold" lineHeight="1.2" color="chart.band.bar">
            {formatDb(db, 'dB')}
          </Text>
          <Text fontWeight="bold" lineHeight="1.2" color="chart.band.ref">
            {formatDb(ref, 'dB')}
          </Text>
          <Text fontSize="xs" color="fg.muted" lineHeight="1.2">
            {formatDeltaDb(db == null || ref == null ? null : db - ref)}
          </Text>
        </>
      )}
    </ChartTooltip>
  );
}
