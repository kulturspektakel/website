import {useMemo} from 'react';
import {Flex} from '@chakra-ui/react';
import {useDeviceState} from './context';
import {LIVE_SERIES} from './series';
import {BigNumberRow} from './BigNumber';
import {LevelTrace} from './LevelTrace';
import {BandSpectrumChart} from './BandSpectrumChart';
import {X_AXIS_H_ROTATED} from './chartUtils';
import {useDeviceView} from './deviceView';
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

  // The one monitor this page is about, in the shape a trace of several would take.
  // Stable, so the chart is not handed a new list on every arriving record.
  const lines = useMemo(() => deviceLines(device), [device]);

  const latest = deviceState?.latest ?? null;

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
        value={(s) => (latest ? s.get(latest) : null)}
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
