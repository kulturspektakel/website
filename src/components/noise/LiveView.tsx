import {useMemo, useRef} from 'react';
import {Box, Flex, Splitter} from '@chakra-ui/react';
import {useDeviceState, useTick} from './context';
import {seriesByKey} from './series';
import {isRangeKey, seriesLabel} from './level';
import {ReadingTiles} from './LocationReadings';
import {LevelTrace} from './LevelTrace';
import {BandSpectrumChart} from './BandSpectrumChart';
import {X_AXIS_H_ROTATED} from './chartUtils';
import {useDeviceView} from './deviceView';
import {GAP_THRESHOLD_S, isFresh} from './noise';
import {exceedsLimit, limitAt, type LimitLine} from './limitLines';
import {deviceLines} from './projectView';
import {decidingLimit, type SeriesLimit} from './limitState';
import {useDeviceSplit} from './deviceSplit';

// The two rows of the page and what each may be dragged to. The readings keep their height in
// pixels when the window changes (`preserve-pixel-size`) — a row of numbers sized to be read
// from a given distance should stay that size, and the charts are the ones with room to give
// — and may take at most most of the page, so there is always a chart to read them against.
// The charts' floor is about the least a trace and its axes are readable in.
const SPLIT_PANELS = [
  {
    id: 'readings',
    // The smallest badges (1rem type, see ReadingTiles' `fit`) and the padding above the
    // divider.
    minSize: '4rem',
    maxSize: '70%',
    resizeBehavior: 'preserve-pixel-size' as const,
  },
  {id: 'charts', minSize: '240px'},
];
// Where the readings row starts for a screen nobody has arranged: about the height the
// badges had at their old fixed size, and the padding above the divider. Only the first panel's: the charts take the rest.
const DEFAULT_SPLIT = ['7rem'];

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
  const {picked} = useDeviceView();
  // Whether the latest record is still the reading *now*, which is what decides between
  // printing it and printing nothing at all.
  const now = useTick();

  // The one monitor this page is about, in the shape a trace of several would take.
  // Stable, so the chart is not handed a new list on every arriving record.
  const lines = useMemo(() => deviceLines(device), [device]);

  // What the tiles print: the latest record, but only while it is still current. A monitor
  // that has gone quiet has no reading to show, and the last thing it said, left standing
  // under the live labels, reads as one; the trace beside it has already broken its line by
  // then, so the same threshold decides both.
  //
  // Always now, wherever the pointer is: these are the instrument's headline numbers, and a
  // reading that froze on whatever second the hand happened to rest on stopped being a
  // live readout exactly while somebody was looking at it. What was measured under the
  // pointer is the trace's tooltip's to say.
  const current = isFresh(deviceState?.lastSeen, now, GAP_THRESHOLD_S * 1000)
    ? deviceState!.latest
    : null;

  // The limits a badge's glow answers for: every one in force this second. Series
  // limits only: a `Leq,T` is judged on the Leq of its whole hours, which this page, holding
  // the last few minutes, has no way to know.
  const activeLimits = limits.filter(
    (limit): limit is SeriesLimit =>
      !isRangeKey(limit.series) && limit.start <= now && now < limit.end,
  );

  // How the page is divided between the readings and the charts, which the divider between
  // them moves and this browser remembers — for as long as the window is about the size it
  // was arranged in (see useDeviceSplit).
  const splitBox = useRef<HTMLDivElement | null>(null);
  const split = useDeviceSplit(splitBox, DEFAULT_SPLIT);

  return (
    <Splitter.Root
      ref={splitBox}
      orientation="vertical"
      flex="1"
      minH="0"
      panels={SPLIT_PANELS}
      size={split.size}
      onResize={split.onResize}
      onResizeEnd={split.onResizeEnd}
    >
      {/* One badge per series the toolbar has picked — the same badges, in the same order,
          as a location card's header (see ReadingTiles), since they are the same numbers:
          what this monitor reads, the line's colour under its name, and red against the
          place's limit where one is in force, glowing into the number of the badge whose
          series that limit is written against. Read off the latest record, whatever the
          pointer is over — the trace's tooltip reads that out. Not toggles: the menu above is what
          picks the lines, and these are their readout. */}
      {/* A size container, which is what the badges are sized off: as large as the row
          the divider below has made, spread across the width (see ReadingTiles' `fit`). */}
      <Splitter.Panel
        id="readings"
        display="flex"
        // Against the top, so whatever height the badges don't fill — the width can be the
        // tighter bound (see ReadingTiles' `fit`) — gathers by the divider, which has air
        // of its own, rather than as a gap under the toolbar.
        alignItems="flex-start"
        // Air between the numbers and the divider, and the charts and it (below) — as
        // padding inside the panels rather than margin on the divider, whose line and grip
        // the splitter positions for a divider exactly its own thin height. Padding is also
        // outside what the badges are sized off: container units measure the content box.
        pb="4"
        css={{containerType: 'size'}}
      >
        <Box w="full">
          <ReadingTiles
            // The page's headline numbers: filling the row they are given, spread across
            // the page rather than stretched to fill it (see ReadingTiles).
            size="fit"
            spread
            tiles={picked.map((key) => {
              const db = current ? seriesByKey(key).get(current) : null;
              const limitDb = limitAt(limits, key, now);
              // The glow on a badge whose series has a limit in force — judged on the latest
              // record, since it says where the place stands now (see judgeLimit). Of several on one series, the one in the worst
              // state (see decidingLimit). Where there is one, it is what says "over": the
              // badge no longer turns red as well (see ReadingTile).
              const own = activeLimits.filter((limit) => limit.series === key);
              const limitState =
                own.length > 0
                  ? (decidingLimit(own, current ?? null)?.state ?? null)
                  : undefined;
              return {
                key,
                db,
                label: seriesLabel(key, true),
                color: seriesByKey(key).color,
                limitDb,
                over: db != null && exceedsLimit(db, limitDb),
                limitState,
              };
            })}
          />
        </Box>
      </Splitter.Panel>
      {/* The divider: a rule across the page with a grip at its middle, dragged to give the
          numbers or the charts more of it — or moved with the arrow keys once focused. */}
      <Splitter.ResizeTrigger
        id="readings:charts"
        aria-label="Resize readings and charts"
      >
        <Splitter.ResizeTriggerSeparator />
        <Splitter.ResizeTriggerIndicator />
      </Splitter.ResizeTrigger>
      <Splitter.Panel id="charts" display="flex" flexDirection="column" pt="4">
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
      </Splitter.Panel>
    </Splitter.Root>
  );
}
