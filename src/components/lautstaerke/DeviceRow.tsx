import {Link} from '@tanstack/react-router';
import {HStack, Text, VStack} from '@chakra-ui/react';
import type {ReactNode} from 'react';
import {useBluetooth, useNoiseLive, useTick} from './context';
import {decodeDb, formatLastSeen} from './noise';
import {displayedLevel, formatDb} from './level';
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
  historyDb,
  action,
}: {
  deviceName: string;
  // Bold line above the mono device id; omitted when the device has no location.
  locationName?: string | null;
  // Epoch ms from the DB's Device.lastSeen. Only rendered when there's no level to
  // show, and maxed with the newest MQTT message seen this session.
  lastSeen?: number | null;
  // Which number to show is decided by displayedLevel, shared with the map pins.
  // The defaults are the standalone case (the index page's unassigned monitors):
  // live, with no playhead to read from.
  live?: boolean;
  historyDb?: number | null;
  // Trailing control, rendered outside the <Link> so it stays clickable and the
  // row doesn't nest interactive elements — e.g. "Zuweisung beenden".
  action?: ReactNode;
}) {
  const ctx = useNoiseLive();
  const bluetooth = useBluetooth();
  // Local tick: freshness is per-row, so this doesn't re-render its siblings.
  const now = useTick();
  const state = ctx.devices[deviceName];
  const level = displayedLevel({live, now, state, historyDb});
  const ble = deviceName === bluetooth.deviceName;
  const seen = Math.max(lastSeen ?? 0, state?.lastSeen ?? 0);

  return (
    <HStack
      py="3"
      pl="4"
      pr={action ? '2' : '3'}
      gap="2"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
      cursor="pointer"
      _hover={{bg: 'gray.800'}}
    >
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
                  {formatDb(level.db, 'dB(A)')}
                </Text>
                {/* The trailing 5-minute Leq rides along on the live record, so
                    it only exists in live mode. */}
                {level.kind === 'live' && (
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.500"
                    lineHeight="1"
                  >
                    {formatDb(
                      state!.latest.laeq5m == null
                        ? null
                        : decodeDb(state!.latest.laeq5m),
                      'dB(A) 5m',
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
