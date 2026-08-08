import {Link} from '@tanstack/react-router';
import {Box, HStack, Text, VStack} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {useBluetooth, useNoiseLive, useTick} from './context';
import {formatLastSeen, type Weighting} from './noise';
import {
  displayedLevel,
  formatDb,
  liveDb,
  weightingUnit,
  type LevelMetric,
} from './level';
import {BatteryChip} from './BatteryChip';
import {LiveStatusDot} from './LiveStatusDot';

// One noise monitor as a list row, linking to its live/history view. Which
// devices to render and what to call their location are the caller's business
// (a project's locations, or the unassigned monitors on the index); everything
// live — the activity dot, the current levels, the battery — comes from the
// layout's MQTT/BLE context.
export function DeviceRow({
  deviceName,
  locationName,
  lastSeen,
  live = true,
  metric = 'eq_fast',
  weighting = 'A',
  historyDb,
  action,
  chart,
}: {
  deviceName: string;
  // Bold line above the mono device id; omitted when the device has no location.
  locationName?: string | null;
  // Epoch ms from the DB's Device.lastSeen. Only rendered when there's no level to
  // show, and maxed with the newest MQTT message seen this session.
  lastSeen?: number | null;
  // Which number to show is decided by displayedLevel, shared with the map pins.
  // The defaults are the standalone case (the index page's unassigned monitors):
  // the finest Leq, A-weighted, live, with no playhead to read from.
  live?: boolean;
  metric?: LevelMetric;
  weighting?: Weighting;
  historyDb?: number | null;
  // Trailing control, rendered outside the <Link> so it stays clickable and the
  // row doesn't nest interactive elements — e.g. "Zuweisung beenden".
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
  const level = displayedLevel({
    live,
    now,
    metric,
    weighting,
    state,
    historyDb,
  });
  const unit = weightingUnit(weighting);
  const ble = deviceName === bluetooth.deviceName;
  const seen = Math.max(lastSeen ?? 0, state?.lastSeen ?? 0);

  return (
    <VStack
      align="stretch"
      gap="0"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
      cursor="pointer"
      _hover={{bg: 'gray.800'}}
    >
      <HStack py="3" pl="4" pr={action ? '2' : '3'} gap="2">
        <HStack asChild flex="1" minW="0" gap="2">
          <Link to="/crew/lautstaerke/$device" params={{device: deviceName}}>
            <LiveStatusDot lastSeen={state?.lastSeen} ble={ble} />
            <DeviceTitle
              deviceName={deviceName}
              locationName={locationName}
              batteryMv={state?.latest.batteryMv}
            />
            <VStack gap="1" align="end" minW="0">
              {level.kind === 'none' ? (
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color="gray.500"
                  lineHeight="1"
                >
                  {seen > 0 ? formatLastSeen(seen, now) : 'nie gesehen'}
                </Text>
              ) : (
                <>
                  <Text fontFamily="mono" fontWeight="bold" lineHeight="1">
                    {formatDb(level.db, unit)}
                  </Text>
                  {/* The trailing 5-minute Leq rides along on the live record, so
                      it only exists in live mode — and only says anything the line
                      above doesn't when that line is the 1 s value. */}
                  {level.kind === 'live' && metric === 'eq_fast' && (
                    <Text
                      fontFamily="mono"
                      fontSize="xs"
                      color="gray.500"
                      lineHeight="1"
                    >
                      {formatDb(
                        liveDb(state!.latest, 'eq_5m', weighting),
                        `${unit} 5m`,
                      )}
                    </Text>
                  )}
                </>
              )}
            </VStack>
          </Link>
        </HStack>
        {action}
      </HStack>
      {/* Under the row, not beside it: at row height the trace needs the full
          width to be legible, and the numbers stay where they were. */}
      {chart && (
        // Not part of the link above it, so it gets the default cursor rather
        // than inheriting the row's pointer for an area that isn't clickable.
        <Box px="3" pb="3" cursor="default">
          {chart}
        </Box>
      )}
    </VStack>
  );
}

function DeviceTitle({
  deviceName,
  locationName,
  batteryMv,
}: {
  deviceName: string;
  locationName: string | null | undefined;
  batteryMv: number | undefined;
}) {
  const battery = batteryMv != null && <BatteryChip mv={batteryMv} />;
  return (
    <VStack align="start" gap="0" flex="1" minW="0">
      {locationName && (
        <Text truncate w="full" fontWeight="bold">
          {locationName}
        </Text>
      )}
      <HStack gap="2">
        <Text
          fontFamily="mono"
          fontSize={locationName ? 'xs' : undefined}
          fontWeight={locationName ? undefined : 'bold'}
          color={locationName ? 'gray.500' : undefined}
          truncate
          minW="0"
        >
          {deviceName}
        </Text>
        {battery}
      </HStack>
    </VStack>
  );
}
