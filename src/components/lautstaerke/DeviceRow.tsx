import {Box, HStack, Text, VStack} from '@chakra-ui/react';
import type {ReactNode} from 'react';
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
  loudestIndex,
  metricTag,
  weightingUnit,
  type DisplayedLevel,
  type LevelMetric,
} from './level';
import {seriesFor} from './series';
import {coverageDetail} from './leq';
import {type RangeTotals} from './projectLogs';
import {BatteryChip} from './BatteryChip';
import {LiveStatusDot} from './LiveStatusDot';

// One monitor's half of the readings: who it is, and what the page has already
// resolved for it out of the project's logs. Everything live is looked up from the
// context by name.
type DeviceReading = {
  deviceName: string;
  // Epoch ms from the DB's Device.lastSeen. Only rendered when there's no level to
  // show, and maxed with the newest MQTT message seen this session.
  lastSeen?: number | null;
  // The selected window at the playhead, already decoded. Undefined while loading.
  historyDb?: number | null;
  // The Leq over the whole selected timeframe, which is what the row leads with when
  // not live, plus how much of that timeframe it was measured over. Absent while
  // live: an instant has no range to average over it.
  total?: RangeTotals | null;
};

// What it takes to read levels off a set of monitors — one for a row on the index, a
// location's whole set for the card that stands for it.
type DeviceLevelsProps = {
  devices: DeviceReading[];
  // Which numbers to show is decided by displayedLevel, shared with the map pins.
  // The defaults are the standalone case (the index page's unassigned monitors):
  // the finest Leq, A-weighted, live, with no playhead and no timeframe to read from.
  live?: boolean;
  // The header's window — the second, coloured number. Not what the row leads with:
  // that one is fixed (see below), so the page-wide pick adds a reading rather than
  // replacing the one every row is compared on.
  metric?: LevelMetric;
  weighting?: Weighting;
};

// One noise monitor as a list row: a bordered box with no padding and nothing
// clickable, so the caller decides how it sits in its surroundings. What is left
// after the project list stopped using it — the index's unassigned monitors, which
// belong to no location and so have no timeframe, no menu and nothing to plot.
//
// Nothing but arrangement: who the monitor is and how loud it is are the two parts
// below, and a caller with slots of its own — the location card, which is a row for a
// place rather than for a device — places those same two rather than a variant of
// this.
// A monitor with no location has no timeframe either, so the page-wide display
// settings never reach here — DeviceLevels' own defaults are exactly this case.
export function DeviceRow(device: DeviceReading) {
  return (
    <DeviceRowFrame>
      <HStack gap="2">
        <DeviceIdentity deviceName={device.deviceName} />
        <DeviceLevels devices={[device]} />
      </HStack>
    </DeviceRowFrame>
  );
}

// The box one row sits in. Its own component because a caller that has placed the
// row's parts itself — the location card, whose readings are in its header — still
// puts what is left in the same box, and one border is one decision.
export function DeviceRowFrame({children}: {children: ReactNode}) {
  return (
    <Box rounded="md" borderWidth="1px" borderColor="gray.700">
      {children}
    </Box>
  );
}

// Who the monitor is: whether it is alive, what it is called, and what its battery
// is at. Everything comes out of the live context, so the only thing a caller needs
// to know is the device's name.
//
// One rendering wherever it goes — a row of its own, or the line under a location's
// name — so a monitor is recognisably the same thing in both. Secondary type, because
// in neither place is the name the point: the reading beside it is.
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

// How loud it is: the two readings, what they are averaged over, and — when neither
// is of now — when we last heard from the monitor at all.
//
// Given several monitors it speaks for the loudest of them — the rule a map pin has
// always used for a location holding more than one (see loudestLevel), because the
// loudest is what matters against a noise limit. Both readings come off that one
// monitor: two numbers picked from two monitors would describe nothing.
//
// The pin ranks on the picked window and this ranks on the lead, so where a location's
// monitors disagree about which of them is loudest, the pin and the coloured number
// here can be reading different ones. The tie is broken the same way in both; which
// quantity it is broken on follows what each view leads with.
export function DeviceLevels({
  devices,
  live = true,
  metric = 'eq_fast',
  weighting = 'A',
}: DeviceLevelsProps) {
  // One wake-up for the row's whole set — a location's two monitors are read together
  // and printed as one reading, so there is nothing to gain from rendering them apart.
  const deviceState = useDeviceStates(devices.map((d) => d.deviceName));
  // Local tick: freshness is per-row, so this doesn't re-render its siblings.
  const now = useTick();

  const readings = devices.map(({deviceName, lastSeen, historyDb, total}) => {
    const state = deviceState(deviceName);
    // Two readings, and the same rules decide both — a stale stream blanks them
    // together, and neither invents a number the device didn't report.
    //
    // The lead is fixed, so the rows of a page are always comparable on it: the Leq
    // over the selected timeframe when scrubbing, and the finest live value when live,
    // which is that mode's answer to the same question ("how loud is it here"). The
    // picked window follows it as a second number — in its line's colour, so it reads
    // against the trace under the row rather than as another anonymous dB figure.
    const lead: DisplayedLevel = live
      ? displayedLevel({live, now, metric: 'eq_fast', weighting, state})
      : total == null
        ? {kind: 'none'}
        : {kind: 'history', db: total.db};
    return {
      lead,
      // Withheld when it would restate the lead — live at the finest window is the
      // very number above it, and printing it twice in two colours says there are two.
      selected:
        live && metric === 'eq_fast'
          ? ({kind: 'none'} as DisplayedLevel)
          : displayedLevel({live, now, metric, weighting, state, historyDb}),
      // A Leq over a crop is an average of the minutes that were measured, so how many
      // there were is part of the reading: without it a monitor present for two
      // minutes of an hour is indistinguishable from one present for all of it. Same
      // rule as the device page's Leq tile, thresholds included, so a shortfall too
      // small to matter stays unsaid in both — the row just puts it behind a sign
      // rather than printing it, having no room for a third figure beside two numbers.
      coverage: total ? coverageDetail(total) : undefined,
      seen: Math.max(lastSeen ?? 0, state?.lastSeen ?? 0),
    };
  });

  // Picked on the lead, since that is the number the row is compared on; on the second
  // reading only when no monitor has a lead at all, so a set that can only answer the
  // picked window still answers it. (loudestIndex returns -1 for nothing to show,
  // which indexes to undefined and falls through.)
  const shown =
    readings[loudestIndex(readings.map((r) => r.lead))] ??
    readings[loudestIndex(readings.map((r) => r.selected))];
  const lead = shown?.lead ?? {kind: 'none'};
  const selected = shown?.selected ?? {kind: 'none'};
  const coverage = shown?.coverage;
  const unit = weightingUnit(weighting);
  // Live, the lead is a window like any other and names itself. Scrubbing, it is the
  // Leq over the whole crop — which has no window to name, and every word for it is
  // longer than the number it would qualify. Left bare: the timeframe is set on the
  // page, in one place, and the reading that follows the header's picker is the one
  // beside it, tagged.
  const leadUnit = live ? `${unit} ${metricTag('eq_fast', true)}` : unit;
  // The newest of them, because this line answers "is anything still arriving here",
  // which is a question about the place and not about whichever monitor was loudest.
  const seen = Math.max(0, ...readings.map((r) => r.seen));
  // Nothing on the row is a reading of now — either it says nothing at all, or what
  // it says is remembered. Either way the useful thing to add is when we last heard,
  // which is what turns a greyed-out number from "is this broken?" into "as of then".
  const remembered = !isCurrent(lead) && !isCurrent(selected);

  return (
    // Never squashed: what gives when the row runs out of width is the device name,
    // which truncates, not the numbers, which don't.
    <VStack gap="1" align="end" minW="0" flexShrink="0">
      {/* Side by side rather than stacked: they are two readings of the same
          monitor, not a headline and its footnote, and a row that keeps them
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
          // Last, and hard against the edge of the row: the numbers every card is
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
              // at the edge of the row: the lead stays hard against it either way, and
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
                timeframe, which is what the row is compared on and what the
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
      {remembered && (
        <Text fontSize="xs" color="gray.500" lineHeight="1">
          {seen > 0 ? formatLastSeen(seen, now) : 'nie gesehen'}
        </Text>
      )}
    </VStack>
  );
}
