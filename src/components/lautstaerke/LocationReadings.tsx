import {Box, HStack, Text, VStack} from '@chakra-ui/react';
import {LuTriangleAlert} from 'react-icons/lu';
import {Tooltip} from '../chakra-snippets/tooltip';
import {
  useBluetooth,
  useDeviceState,
  useDeviceStates,
  useTick,
} from './context';
import {formatLastSeen, type Weighting} from './noise';
import {
  displayedLevel,
  formatDb,
  isCurrent,
  loudestLevel,
  metricTag,
  weightingUnit,
  type DisplayedLevel,
  type LevelMetric,
} from './level';
import {seriesFor} from './series';
import {coverageDetail} from './leq';
import {type RangeTotals} from './projectLogs';
import {type NoiseAssignment} from './projectView';
import {BatteryChip} from './BatteryChip';
import {LiveStatusDot} from './LiveStatusDot';

// The two things a location's header says: which monitors have stood there, and how
// loud it is there. This was the two halves of a per-monitor row, back when a location
// was one row per device standing at it — nothing renders a monitor as a row of its own
// any more, and neither of these speaks for a device.

// Who the monitor is: whether it is alive, what it is called, and what its battery
// is at. Everything comes out of the live context, so the only thing a caller needs
// to know is the device's name.
//
// Secondary type, because the name is not the point: the reading beside it is.
export function DeviceIdentity({deviceName}: {deviceName: string}) {
  const state = useDeviceState(deviceName);
  const bluetooth = useBluetooth();
  const batteryMv = state?.latest.batteryMv;

  return (
    <HStack gap="2" flex="1" minW="0">
      <LiveStatusDot
        lastSeen={state?.lastSeen}
        ble={deviceName === bluetooth.deviceName}
      />
      <Text fontSize="sm" color="gray.500" truncate minW="0">
        {deviceName}
      </Text>
      {batteryMv != null && <BatteryChip mv={batteryMv} />}
    </HStack>
  );
}

// How loud it is *here*: two readings of the place, what they are averaged over, and —
// when neither is of now — when we last heard from anything standing here.
//
// Both numbers are the location's rather than a monitor's, and they are two different
// shapes of the same rule, "the loudest of whatever is here":
//
//   the instant — the loudest of the monitors assigned at the playhead, resolved the
//                 same way and by the same loudestLevel a map pin uses, so the card and
//                 the pin for one place can no longer print different numbers.
//   the crop    — the energetic mean of that loudest, minute by minute, summed upstream
//                 (see locationEnergyIndex). It is the average of the very area the
//                 chart below fills, so the number and the picture agree by construction.
//
// A monitor named in the header but not standing here at the playhead contributes to
// neither: its readings from wherever it went are not this location's.
export function LocationReadings({
  assignments,
  total,
  levels,
  live,
  metric,
  weighting,
}: {
  // The monitors standing here at the instant being viewed — which while live means the
  // ones standing here now. Not the location's whole history: that is what the names
  // above and the chart below are drawn from, and averaging a monitor's time at another
  // stage into this place's reading is the mistake this shape exists to prevent.
  assignments: NoiseAssignment[];
  // This location's Leq over the crop, already the envelope. Absent while live, when an
  // instant has no range to average over it.
  total?: RangeTotals;
  // What the playhead's minute holds for each monitor, from the project's logs.
  // Undefined while live and while the one query behind it is in flight.
  levels?: Record<string, number>;
  // Which numbers to show is decided by displayedLevel, shared with the map pins.
  live: boolean;
  // The header's window — the second, tagged number. Not what the card leads with:
  // that one is fixed (see below), so the page-wide pick adds a reading rather than
  // replacing the one every card is compared on.
  metric: LevelMetric;
  weighting: Weighting;
}) {
  // One wake-up for the header's whole set — a location's two monitors are read
  // together and printed as one reading, so there is nothing to gain from rendering
  // them apart.
  const deviceState = useDeviceStates(assignments.map((a) => a.deviceId));
  // Local tick: freshness is per-card, so this doesn't re-render its siblings.
  const now = useTick();

  // The lead is fixed, so the cards of a page are always comparable on it: the Leq over
  // the selected timeframe when scrubbing, and the loudest live value when live, which
  // is that mode's answer to the same question ("how loud is it here"). The picked
  // window follows it as a second number — in its line's colour, so it reads against
  // the trace under the card rather than as another anonymous dB figure.
  const lead: DisplayedLevel = live
    ? loudestLevel(
        assignments.map((a) =>
          displayedLevel({
            live,
            now,
            metric: 'eq_fast',
            weighting,
            state: deviceState(a.deviceId),
          }),
        ),
      )
    : total == null
      ? {kind: 'none'}
      : {kind: 'history', db: total.db};

  // Withheld when it would restate the lead — live at the finest window is the very
  // number above it, and printing it twice in two colours says there are two.
  const selected: DisplayedLevel =
    live && metric === 'eq_fast'
      ? {kind: 'none'}
      : loudestLevel(
          assignments.map((a) =>
            displayedLevel({
              live,
              now,
              metric,
              weighting,
              state: deviceState(a.deviceId),
              historyDb: levels?.[a.deviceId],
            }),
          ),
        );

  // A Leq over a crop is an average of the minutes that were measured, so how many
  // there were is part of the reading: without it a place monitored for two minutes of
  // an hour is indistinguishable from one monitored throughout. Measured against the
  // minutes a monitor was assigned *here*, so an empty stretch is the location's gap and
  // not charged to the monitor that covered the rest. Same rule as the device page's Leq
  // tile, thresholds included, so a shortfall too small to matter stays unsaid in both —
  // the header just puts it behind a sign rather than printing it, having no room for a
  // third figure beside two numbers.
  const coverage = total ? coverageDetail(total) : undefined;
  const unit = weightingUnit(weighting);
  // Live, the lead is a window like any other and names itself. Scrubbing, it is the
  // Leq over the whole crop — which has no window to name, and every word for it is
  // longer than the number it would qualify. Left bare: the timeframe is set on the
  // page, in one place, and the reading that follows the header's picker is the one
  // beside it, tagged.
  const leadUnit = live ? `${unit} ${metricTag('eq_fast', true)}` : unit;
  // The newest of them, because this line answers "is anything still arriving here",
  // which is a question about the place and not about whichever monitor was loudest.
  const seen = Math.max(
    0,
    ...assignments.map((a) =>
      Math.max(a.lastSeen ?? 0, deviceState(a.deviceId)?.lastSeen ?? 0),
    ),
  );
  // Nothing here is a reading of now — either it says nothing at all, or what it says
  // is remembered. Either way the useful thing to add is when we last heard, which is
  // what turns a greyed-out number from "is this broken?" into "as of then".
  const remembered = !isCurrent(lead) && !isCurrent(selected);

  return (
    // Never squashed: what gives when the header runs out of width is the device name,
    // which truncates, not the numbers, which don't.
    <VStack gap="1" align="end" minW="0" flexShrink="0">
      {/* Side by side rather than stacked: they are two readings of the same
          monitor, not a headline and its footnote, and a header that keeps them
          on one line stays one line tall. Baseline-aligned so the small one
          sits on the big one's baseline instead of floating mid-cap. */}
      <HStack gap="3" align="baseline" minW="0">
        {selected.kind !== 'none' && (
          // First, and the tagged one: it says which window it is, which is what
          // makes the untagged number after it read as the one over everything.
          //
          // Plain, because it is a reading of one instant — whatever the picker
          // is set to, this is what stood there at the playhead. The colour goes
          // to the number beside it, which is the one averaged over the timeframe.
          // Same size as the lead: side by side they are two readings of the
          // same monitor, and a smaller one would rank it below the other
          // rather than beside it. Weight and colour carry the difference.
          <Text
            lineHeight="1"
            whiteSpace="nowrap"
            color={selected.kind === 'stale' ? 'gray.500' : undefined}
          >
            {formatDb(selected.db, `${unit} ${metricTag(metric, live)}`)}
          </Text>
        )}
        {lead.kind !== 'none' && (
          // Last, and hard against the edge of the card: the numbers every card is
          // compared on line up in one column down the page, whether or not the one
          // beside them is there to be shown.
          //
          // The coverage rides with the lead, in the gap-1 pair, so it reads
          // as a caveat on that number rather than a third reading.
          <HStack gap="1" align="baseline" minW="0">
            {coverage && (
              // A sign rather than the sentence: the caveat matters, but it is not a
              // reading, and spelling it out beside two numbers would make three.
              // Focusable, so the tooltip is reachable by keyboard and by tap — a
              // warning nobody can read is worse than no warning.
              //
              // Before the number rather than after it, so the sign is what gives way
              // at the edge of the card: the lead stays hard against it either way, and
              // the column of numbers down the page doesn't step sideways on the one
              // card that has a caveat.
              <Tooltip content={coverage} showArrow>
                <Box
                  asChild
                  alignSelf="center"
                  color="orange.400"
                  fontSize="sm"
                  lineHeight="1"
                >
                  <button type="button" aria-label={coverage}>
                    <LuTriangleAlert />
                  </button>
                </Box>
              </Tooltip>
            )}
            {/* The coloured one: this is the number averaged over the whole
                timeframe, which is what the card is compared on and what the
                trace under it adds up to — so it carries the trace's shade and
                the instant beside it stays plain. Straight from the series
                table, the one place a level's colour is decided.

                Muted when the number is only the last thing we heard, so a
                reading that has stopped moving doesn't keep reading as one
                that hasn't — saying "not now" then matters more than which
                line it belongs to. */}
            <Text
              fontWeight="bold"
              lineHeight="1"
              color={
                lead.kind === 'stale'
                  ? 'gray.500'
                  : seriesFor(metric, weighting).stroke
              }
            >
              {formatDb(lead.db, leadUnit)}
            </Text>
          </HStack>
        )}
      </HStack>
      {remembered && assignments.length > 0 && (
        <Text fontSize="xs" color="gray.500" lineHeight="1">
          {seen > 0 ? formatLastSeen(seen, now) : 'nie gesehen'}
        </Text>
      )}
    </VStack>
  );
}
