import {useCallback, useMemo, useState} from 'react';
import {Flex} from '@chakra-ui/react';
import {useDeviceState, useNoiseBuffers, useTick} from './context';
import {bufferColumn, bufferSampleAt, LIVE_SERIES, seriesKey} from './series';
import {BigNumberRow} from './BigNumber';
import {LevelTrace} from './LevelTrace';
import {BandSpectrumChart} from './BandSpectrumChart';
import {X_AXIS_H_ROTATED} from './chartUtils';
import {useDeviceView} from './deviceView';
import {GAP_THRESHOLD_S, isFresh} from './noise';
import {type LimitLine} from './limitLines';
import {deviceLines} from './projectView';

// One monitor, as it is reading now: the numbers it is sending, the level over the last
// few minutes, and the spectrum that level is made of. The whole of the device page — a
// monitor's past is read at the place it was standing, on the project page.
export function LiveView({
  device,
  limits,
}: {
  device: string;
  // What the place this monitor is standing at is permitted, already resolved against that
  // event's dates by the loader. A prop rather than another field on DeviceViewCtx: that
  // context is what the toolbar picks and the charts read, and this is neither — it is what
  // the route fetched.
  //
  // Empty for a monitor standing nowhere, which is the honest answer: a limit belongs to a
  // place, and this page is about the instrument.
  limits: readonly LimitLine[];
}) {
  // The latest record, which is what the numbers print — so this view does re-render on
  // every one of them, but only on this device's, which is all it shows. The trace reads
  // the rolling buffer itself and redraws on its own tick.
  const deviceState = useDeviceState(device);
  const {picked, toggleSeries} = useDeviceView();
  // The rolling samples, for the numbers to be read out of at the pointer. The chart
  // below has them too and neither hands them to the other: they are a ref, so reading
  // them here costs nothing and subscribes to nothing.
  const buffers = useNoiseBuffers();
  // Whether the latest record is still the reading *now*, which is what decides between
  // printing it and printing nothing at all.
  const now = useTick();

  // The sample the pointer is over, whole, and null whenever it is over nothing — off
  // the plot, or in a gap between samples wide enough that the trace itself breaks
  // there. Held as the sample and not as the pointer's instant so that this state
  // changes once a second at most while sweeping, rather than on every frame of the
  // hover: what the tiles print is the reading, and between two samples there is only
  // ever one of those.
  const [hovered, setHovered] = useState<{
    at: number;
    row: (number | null)[];
  } | null>(null);
  const onScrub = useCallback(
    (at: number | null) => {
      const row =
        at == null
          ? null
          : bufferSampleAt(buffers.current[device], at, GAP_THRESHOLD_S);
      // The sample's own timestamp is the identity: the pointer travelling across the
      // pixels of one sample is not a change, and re-rendering the row for it would put
      // this component back on the hover's frame rate.
      const sampleAt = row?.[0] ?? null;
      setHovered((prev) =>
        sampleAt == null
          ? prev == null
            ? prev
            : null
          : prev?.at === sampleAt
            ? prev
            : {at: sampleAt, row: row!},
      );
    },
    [buffers, device],
  );

  // The one monitor this page is about, in the shape a trace of several would take.
  // Stable, so the chart is not handed a new list on every arriving record.
  const lines = useMemo(() => deviceLines(device), [device]);

  // What the tiles print: the sample under the pointer while there is one, and otherwise
  // the latest record — but only while that record is still current. A monitor that has
  // gone quiet has no reading to show, and the last thing it said, left standing under
  // the live labels, reads as one; the trace beside it has already broken its line by
  // then, so the same threshold decides both. Hovering a gap is the same statement about
  // a past instant, and blanks the row for the same reason.
  const current = isFresh(deviceState?.lastSeen, now, GAP_THRESHOLD_S * 1000)
    ? deviceState!.latest
    : null;

  return (
    <>
      {/* What the toolbar picks are rows of the series table, so they are also the lines
          to plot and the tiles to light — the row and the menu are two ways at one choice,
          and pressing a tile is the same commit as ticking a box. The numbers print every
          series either way: the row is the readout, the lit ones are what you asked to see
          over time. */}
      <BigNumberRow
        series={LIVE_SERIES}
        picked={picked}
        onPick={toggleSeries}
        value={(s) =>
          hovered
            ? hovered.row[bufferColumn(seriesKey(s.kind, s.weighting))]!
            : current
              ? s.get(current)
              : null
        }
      />
      <Flex flex="1" minH="0" direction={{base: 'column', lg: 'row'}} gap="2">
        {/* Side by side where there is room for both, stacked on a phone. The trace takes
            what the spectrum leaves, which is how a location card divides its own box. */}
        <Flex flex="1" minH="0" minW="0">
          {/* The row charts' trace, in its live mode — the same chart a location card
              draws while the project page is live, which is the point: the same monitor
              used to look like two different measurements depending on which page you
              opened it from. */}
          {/* The one place this chart is given a taller bottom gutter than it needs:
              the spectrum to its right turns its 31 frequency labels −45° to fit them
              all, which costs it that much height, and a gutter is height a plot does
              not get. Matched here so the two draw their dB grids on the same lines —
              read a level off one and the same level off the other and they sit at the
              same height. The cost is a little air under the time labels, which on a
              page-tall chart is nothing; a location card's row, where it would not be,
              never passes this. */}
          <LevelTrace
            lines={lines}
            live
            picked={picked}
            // What the tile row above reads out while the pointer is on the trace. The
            // numbers are this chart's legend as well as its readout (see BigNumberRow),
            // so pointing at a sample is how a line is asked what it was, in every series
            // and not only the picked ones the tooltip has room for.
            onScrub={onScrub}
            // Drawn on this chart and not on the spectrum beside it: a limit is written
            // against a level over time, and the spectrum's axis is frequency.
            limits={limits}
            xAxisSize={X_AXIS_H_ROTATED}
          />
        </Flex>
        <BandSpectrumChart state={deviceState} />
      </Flex>
    </>
  );
}
