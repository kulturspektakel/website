import {Box, HStack, Text, VStack} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {useBluetooth, useNoiseLive, useTick} from './context';
import {formatLastSeen, type Weighting} from './noise';
import {
  displayedLevel,
  formatDb,
  isCurrent,
  metricTag,
  weightingUnit,
  type DisplayedLevel,
  type LevelMetric,
} from './level';
import {seriesFor} from './series';
import {coverageNote} from './leq';
import {type RangeTotals} from './projectLogs';
import {BatteryChip} from './BatteryChip';
import {LiveStatusDot} from './LiveStatusDot';

// How the lead number is labelled when it is the Leq over the selected timeframe. It
// is the number one wants off every monitor at once, which is why it is no longer
// something to pick in the header — and why it says what it is, like every other
// reading on the row.
const RANGE_TAG = 'Zeitraum';

// One noise monitor as a list row: a bordered box with no padding and nothing
// clickable, so the caller decides how it sits in its surroundings. Which
// devices to render is the caller's business (a project's locations, or the
// unassigned monitors on the index); everything live — the activity dot, the
// current levels, the battery — comes from the layout's MQTT/BLE context.
export function DeviceRow({
  deviceName,
  lastSeen,
  live = true,
  metric = 'eq_fast',
  weighting = 'A',
  historyDb,
  total,
  action,
  chart,
}: {
  deviceName: string;
  // Epoch ms from the DB's Device.lastSeen. Only rendered when there's no level to
  // show, and maxed with the newest MQTT message seen this session.
  lastSeen?: number | null;
  // Which numbers to show is decided by displayedLevel, shared with the map pins.
  // The defaults are the standalone case (the index page's unassigned monitors):
  // the finest Leq, A-weighted, live, with no playhead and no timeframe to read from.
  live?: boolean;
  // The header's window — the second, coloured number. Not what the row leads with:
  // that one is fixed (see below), so the page-wide pick adds a reading rather than
  // replacing the one every row is compared on.
  metric?: LevelMetric;
  weighting?: Weighting;
  // The selected window at the playhead, already decoded. Undefined while loading.
  historyDb?: number | null;
  // The Leq over the whole selected timeframe, which is what the row leads with when
  // not live, plus how much of that timeframe it was measured over. Absent while
  // live: an instant has no range to average over it.
  total?: RangeTotals | null;
  // Trailing control — e.g. "Zuweisung beenden".
  action?: ReactNode;
  // Optional level trace under the row (see DeviceRowChart). A slot rather than
  // something this component fetches: which window to plot, and whether there is
  // one at all, is the listing page's business — the index's unassigned monitors
  // have no window to plot over.
  chart?: ReactNode;
}) {
  const ctx = useNoiseLive();
  const bluetooth = useBluetooth();
  // Local tick: freshness is per-row, so this doesn't re-render its siblings.
  const now = useTick();
  const state = ctx.devices[deviceName];
  // Two readings, and the same rules decide both — a stale stream blanks them
  // together, and neither invents a number the device didn't report.
  //
  // The lead is fixed, so the rows of a page are always comparable on it: the Leq over
  // the selected timeframe when scrubbing, and the finest live value when live, which
  // is that mode's answer to the same question ("how loud is it here"). The picked
  // window follows it as a second, smaller number — in its line's colour, so it reads
  // against the trace under the row rather than as another anonymous dB figure.
  const lead: DisplayedLevel = live
    ? displayedLevel({live, now, metric: 'eq_fast', weighting, state})
    : total == null
      ? {kind: 'none'}
      : {kind: 'history', db: total.db};
  const leadTag = live ? metricTag('eq_fast', true) : RANGE_TAG;
  // A Leq over a crop is an average of the minutes that were measured, so how many
  // there were is part of the reading: without it a monitor present for two minutes
  // of an hour is indistinguishable from one present for all of it. Same rule and
  // same wording as the device page's Leq tile, thresholds included, so a shortfall
  // too small to matter stays unsaid in both.
  const coverage = total && coverageNote(total);
  // Withheld when it would restate the lead — live at the finest window is the very
  // number above it, and printing it twice in two colours says there are two.
  const selected: DisplayedLevel =
    live && metric === 'eq_fast'
      ? {kind: 'none'}
      : displayedLevel({live, now, metric, weighting, state, historyDb});
  const unit = weightingUnit(weighting);
  const ble = deviceName === bluetooth.deviceName;
  const seen = Math.max(lastSeen ?? 0, state?.lastSeen ?? 0);
  // Nothing on the row is a reading of now — either it says nothing at all, or what
  // it says is remembered. Either way the useful thing to add is when we last heard,
  // which is what turns a greyed-out number from "is this broken?" into "as of then".
  const remembered = !isCurrent(lead) && !isCurrent(selected);

  return (
    <VStack
      align="stretch"
      gap="0"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      <HStack gap="2">
        <HStack flex="1" minW="0" gap="2">
          <LiveStatusDot lastSeen={state?.lastSeen} ble={ble} />
          <DeviceTitle
            deviceName={deviceName}
            batteryMv={state?.latest.batteryMv}
          />
          <VStack gap="1" align="end" minW="0">
            {/* Side by side rather than stacked: they are two readings of the same
                monitor, not a headline and its footnote, and a row that keeps them
                on one line stays one line tall. Baseline-aligned so the small one
                sits on the big one's baseline instead of floating mid-cap. */}
            <HStack gap="3" align="baseline" minW="0">
              {lead.kind !== 'none' && (
                // The coverage rides with the lead, in the gap-1 pair, so it reads
                // as a caveat on that number rather than a third reading.
                <HStack gap="1" align="baseline" minW="0">
                  {/* Muted when the number is only the last thing we heard, so a
                      reading that has stopped moving doesn't keep reading as one
                      that hasn't. */}
                  <Text
                    fontWeight="bold"
                    lineHeight="1"
                    color={lead.kind === 'stale' ? 'gray.500' : undefined}
                  >
                    {formatDb(lead.db, `${unit} ${leadTag}`)}
                  </Text>
                  {coverage && (
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      lineHeight="1"
                      whiteSpace="nowrap"
                    >
                      {coverage}
                    </Text>
                  )}
                </HStack>
              )}
              {selected.kind !== 'none' && (
                // The colour is the whole point of this one: it is the shade the
                // trace under the row is drawn in, so the number and the line are
                // visibly the same quantity. Straight from the series table, the one
                // place a level's colour is decided — until it goes stale, when
                // saying "not now" matters more than which line it belongs to.
                // Same size as the lead: side by side they are two readings of the
                // same monitor, and a smaller one would rank it below the other
                // rather than beside it. Weight and colour carry the difference.
                <Text
                  lineHeight="1"
                  whiteSpace="nowrap"
                  color={
                    selected.kind === 'stale'
                      ? 'gray.500'
                      : seriesFor(metric, weighting).stroke
                  }
                >
                  {formatDb(selected.db, `${unit} ${metricTag(metric, live)}`)}
                </Text>
              )}
            </HStack>
            {remembered && (
              <Text fontSize="xs" color="gray.500" lineHeight="1">
                {seen > 0 ? formatLastSeen(seen, now) : 'nie gesehen'}
              </Text>
            )}
          </VStack>
        </HStack>
        {action}
      </HStack>
      {/* Under the row, not beside it: at row height the trace needs the full
          width to be legible, and the numbers stay where they were. */}
      {chart && <Box>{chart}</Box>}
    </VStack>
  );
}

function DeviceTitle({
  deviceName,
  batteryMv,
}: {
  deviceName: string;
  batteryMv: number | undefined;
}) {
  return (
    <HStack gap="2" flex="1" minW="0">
      <Text fontWeight="bold" truncate minW="0">
        {deviceName}
      </Text>
      {batteryMv != null && <BatteryChip mv={batteryMv} />}
    </HStack>
  );
}
