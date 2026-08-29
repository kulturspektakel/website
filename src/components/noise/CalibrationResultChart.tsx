import {useEffect, useMemo, useRef, useState} from 'react';
import {Box, HStack, Stack, Text} from '@chakra-ui/react';
import uPlot from 'uplot';
import {BAND_FREQUENCIES} from './bluetooth';
import {
  AXIS_GAP,
  axisBase,
  bandAxis,
  bandRange,
  CHART_PADDING,
  cursorAnchor,
  fmtHz,
  gridStep,
  labelStride,
  plotHeight,
} from './chartUtils';
import {themeHex} from '../../theme-noise';
import {ChartTooltip} from './ChartTooltip';
import {formatDb, formatDeltaDb} from './level';
import {type CalibrationResult} from './bandCalibration';

// What a finished run found: one bar per band, how far the monitor is from the reference
// microphone there. The same 31 bands as the live spectrum above it, off the same axis (see
// bandAxis) — the two are read against each other, so they cannot letter their bands two ways.
//
// Bars rather than a line, and from zero rather than from the floor of the scale: the finding is
// signed, and a bar hanging below the baseline says "reads low" without anything having to
// explain the convention. uPlot's default `fillTo` is 0 on a linear scale, so the baseline is
// the zero line by construction rather than by a drawn rule.

const FREQS = BAND_FREQUENCIES;

// Zero always in the middle, and the scale no tighter than this either side. Two instruments
// that agree to within a dB would otherwise be drawn as a mountain range of half-decibel bars
// filling the plot — the auto-range would be doing exactly its job and the chart would be
// lying about the size of what it shows.
//
// Three rather than six: a floor high enough to flatten a good result also flattens a real
// one, and a couple of decibels in a band is worth trimming. Still enough that a sub-decibel
// result cannot fill the plot, which is the only thing this is here to prevent.
const MIN_SPAN_DB = 3;

// The y grid's ladder, coarsening as the difference grows. Every step divides the one above it,
// so a wider result thins its grid out rather than moving every line somewhere new — the same
// rule the level charts' DB_GRID_STEPS follow.
const DELTA_GRID_STEPS = [1, 2, 5, 10, 20];
const DELTA_GRID_SPACE = 16;
// And the closest two *numbers* may sit, which is the larger of the two: lines only have to be
// told apart where labels stack. One line box of 10 px type and half as much again of air, the
// same figure the level charts' axis is spaced by and for the same reason.
const DELTA_LABEL_SPACE = 22;
// Wider than the level axis' gutter: these labels carry a sign, so "−10" is a character more
// than the "110" that one is sized for.
const DELTA_AXIS_W = AXIS_GAP + 26;

// The one chart in the section drawn on a light ground: its panel is portalled and no
// longer re-establishes the dark scope the page has (see ReferenceMicPanel). Said here
// rather than sniffed, because a canvas has no appearance to read — see themeHex, which
// is where the two halves of every colour below are kept.
const APPEARANCE = 'light';

export function CalibrationResultChart({result}: {result: CalibrationResult}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xs = useMemo(() => FREQS.map((_, i) => i), []);
  const [hover, setHover] = useState<{
    idx: number;
    left: number;
    top: number;
    fraction: number;
  } | null>(null);

  const {difference, laeq} = result;
  // Symmetric about zero, off the largest bar there is. Recomputed with the result rather than
  // read off the scale, because the plot below is rebuilt per result anyway — a finished run is
  // a still picture, not a stream.
  const span = useMemo(() => {
    const widest = difference.reduce<number>(
      (max, v) => (v == null ? max : Math.max(max, Math.abs(v))),
      0,
    );
    return Math.max(MIN_SPAN_DB, Math.ceil(widest));
  }, [difference]);

  // Built per result, not once and fed: a run finishes and the chart is done changing, so there
  // is nothing here for a setData path to buy.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const height = () => plotHeight(container, 200);

    const plot = new uPlot(
      {
        width: container.clientWidth || 320,
        height: height(),
        legend: {show: false},
        cursor: {y: false, points: {show: false}, drag: {x: false, y: false}},
        scales: {
          x: {time: false, range: () => bandRange(FREQS.length)},
          y: {range: () => [-span, span]},
        },
        axes: [
          bandAxis(FREQS, APPEARANCE),
          {
            ...axisBase(APPEARANCE),
            size: DELTA_AXIS_W,
            incrs: (_self, _idx, scaleMin, scaleMax, fullDim) => [
              gridStep(
                DELTA_GRID_STEPS,
                scaleMax - scaleMin,
                fullDim,
                DELTA_GRID_SPACE,
              ),
            ],
            space: 1,
            // Signed, because the sign is the reading. Unsigned they would be a scale of
            // magnitudes with no way to tell the half above zero from the half below.
            values: (u, splits) => {
              const step = labelStride(u, splits, 'y', DELTA_LABEL_SPACE);
              return splits.map((v, i) =>
                i % step ? null : v > 0 ? `+${v}` : String(v),
              );
            },
          },
        ],
        padding: CHART_PADDING,
        series: [
          {
            label: 'Frequency',
            value: (_u, v) =>
              v == null ? '' : `${fmtHz(FREQS[Math.round(v)] ?? 0)} Hz`,
          },
          {
            label: 'Difference',
            stroke: themeHex('chart.band.bar', APPEARANCE),
            fill: themeHex('chart.band.bar', APPEARANCE),
            paths: uPlot.paths.bars!({size: [0.85, 60]}),
            points: {show: false},
            value: (_u, v) => formatDeltaDb(v ?? null),
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
      },
      [xs, difference] as uPlot.AlignedData,
      container,
    );

    const ro = new ResizeObserver(() => {
      plot.setSize({width: container.clientWidth, height: height()});
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
      plot.destroy();
    };
  }, [xs, difference, span]);

  // The two levels and what separates them. The difference is the finding, so it is uncoloured
  // and carries its sign — the same treatment it gets in the tooltip, where it leads the bands'
  // own two levels for the same reason.
  const cells = [
    {
      label: 'Monitor',
      value: formatDb(laeq.device, 'dB(A)'),
      color: 'chart.band.bar',
    },
    {
      label: 'Reference',
      value: formatDb(laeq.reference, 'dB(A)'),
      color: 'chart.band.ref',
    },
    {
      label: 'Difference',
      value: formatDeltaDb(laeq.difference, 'dB(A)'),
      color: undefined,
    },
  ];

  return (
    <Stack gap="2" w="full">
      {/* The A-weighted comparison, over the spectrum it is the sum of.

          Above the chart and not in it: two of the three are absolute levels where every bar
          below is a difference, so there is no axis they could share — and the one number a
          permit is written against should not have to be hovered for. Three equal cells
          because the row is read across: two levels and what separates them, in the colours
          the bands' own readout names the instruments in. */}
      <HStack gap="2" w="full">
        {cells.map(({label, value, color}) => (
          // `1 1 0` and not `1`: an equal share of the row rather than an equal share of what
          // is left over, so the three stay the same width whatever they happen to read —
          // "—" in one and "+10.4 dB(A)" in another would otherwise size them differently.
          <Box key={label} flex="1 1 0" textAlign="center">
            <Text fontSize="xs" color="fg.subtle" lineHeight="1.2">
              {label}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="bold"
              color={color}
              lineHeight="1.3"
            >
              {value}
            </Text>
          </Box>
        ))}
      </HStack>
      <Box position="relative" w="full" h="200px">
        <Box
          position="absolute"
          inset="0"
          ref={containerRef}
          overflow="hidden"
        />
        {hover && (
          <ChartTooltip
            left={hover.left}
            top={hover.top}
            fraction={hover.fraction}
          >
            <Text fontSize="xs" color="fg.muted" lineHeight="1.2">
              {fmtHz(FREQS[hover.idx] ?? 0)} Hz
            </Text>
            {/* The difference first and in bold, since it is the finding, and both levels under
              it in the colours the live chart draws them in — a difference on its own cannot be
              sanity-checked, and a band where both instruments are near their floor produces
              one that looks like any other.

              Named as well as coloured, unlike the live chart's readout above: there the two
              lines are on screen beside the pill in those same colours, so the colour is a
              pointer at something visible. Here the finding is a single set of bars and the two
              levels behind it are not drawn at all, which leaves the colour matching nothing —
              and "which of these is the monitor" is the whole question a reader checking a
              suspicious band has come to the tooltip to ask. */}
            <Text fontWeight="bold" lineHeight="1.2">
              {formatDeltaDb(difference[hover.idx] ?? null)}
            </Text>
            <Text fontSize="xs" color="chart.band.bar" lineHeight="1.2">
              Monitor {formatDb(result.device[hover.idx] ?? null, 'dB')}
            </Text>
            <Text fontSize="xs" color="chart.band.ref" lineHeight="1.2">
              Reference {formatDb(result.reference[hover.idx] ?? null, 'dB')}
            </Text>
          </ChartTooltip>
        )}
      </Box>
    </Stack>
  );
}
