import {createFileRoute, Link} from '@tanstack/react-router';
import {
  Box,
  Center,
  HStack,
  Heading,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  decodeDb,
  formatLastSeen,
  isFresh,
  useLautstaerkeCtx,
  useTick,
} from '../components/lautstaerke/context';
import {BatteryChip} from '../components/lautstaerke/BatteryChip';
import {BluetoothMenu} from '../components/lautstaerke/BluetoothMenu';

export const Route = createFileRoute('/crew/lautstaerke/')({
  component: DeviceList,
});

function DeviceList() {
  const ctx = useLautstaerkeCtx();
  const now = useTick();
  // DB-registered devices are always listed; devices first seen via MQTT are
  // added on the fly so newly discovered monitors show up without a DB entry.
  // Ordering: the Bluetooth-connected device first, then active (recently seen)
  // devices, then by location name, then by device name as the final tie-breaker.
  const bleName = ctx.bluetooth.deviceName;
  const names = [
    ...new Set([...ctx.deviceIds, ...Object.keys(ctx.devices)]),
  ].sort((a, b) => {
    const aBle = a === bleName;
    const bBle = b === bleName;
    if (aBle !== bBle) return aBle ? -1 : 1;

    const aActive = isFresh(ctx.devices[a]?.lastSeen, now);
    const bActive = isFresh(ctx.devices[b]?.lastSeen, now);
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aLoc = ctx.deviceLocations[a];
    const bLoc = ctx.deviceLocations[b];
    if (aLoc !== bLoc) {
      if (!aLoc) return 1;
      if (!bLoc) return -1;
      return aLoc.localeCompare(bLoc);
    }
    return a.localeCompare(b);
  });

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      <HStack mb="4" justify="space-between" align="center">
        <Heading as="h1" size="2xl">
          Lautstärke
        </Heading>
        <BluetoothMenu />
      </HStack>
      {names.length === 0 && !ctx.connected ? (
        <Center flex="1" py="10">
          <Spinner size="lg" />
        </Center>
      ) : names.length === 0 ? (
        <Text color="gray.500">Keine Lärmmessgeräte registriert.</Text>
      ) : (
        <VStack align="stretch" gap="2" pb="4">
          {names.map((name) => {
            const state = ctx.devices[name];
            const active = isFresh(state?.lastSeen, now);
            const ble = name === bleName;
            // Newest of the DB's lastSeen and the latest MQTT message we've seen
            // this session; shown only while the device isn't currently active.
            const lastSeen = Math.max(
              ctx.deviceLastSeen[name] ?? 0,
              state?.lastSeen ?? 0,
            );
            return (
              <Box
                key={name}
                asChild
                py="3"
                pl="4"
                pr="3"
                rounded="md"
                borderWidth="1px"
                borderColor="gray.700"
                _hover={{bg: 'gray.800'}}
              >
                <Link to="/crew/lautstaerke/$device" params={{device: name}}>
                  <HStack>
                    <Box
                      w="3"
                      h="3"
                      mr="2"
                      rounded="full"
                      flexShrink="0"
                      bg={ble ? 'blue.500' : active ? 'green.500' : 'gray.400'}
                    />
                    <DeviceTitle
                      deviceName={name}
                      locationName={ctx.deviceLocations[name]}
                      batteryMv={state?.latest.batteryMv}
                    />
                    <VStack gap="1" align="end" minW="0">
                      {active ? (
                        <>
                          <Text
                            fontFamily="mono"
                            fontWeight="bold"
                            lineHeight="1"
                          >
                            {decodeDb(state!.latest.laeq).toFixed(1)} dB(A)
                          </Text>
                          <Text
                            fontFamily="mono"
                            fontSize="xs"
                            color="gray.500"
                            lineHeight="1"
                          >
                            {state!.latest.laeq5m == null
                              ? '— dB(A) 5m'
                              : `${decodeDb(state!.latest.laeq5m).toFixed(1)} dB(A) 5m`}
                          </Text>
                        </>
                      ) : (
                        <Text
                          fontFamily="mono"
                          fontSize="xs"
                          color="gray.500"
                          lineHeight="1"
                        >
                          {lastSeen > 0
                            ? formatLastSeen(lastSeen, now)
                            : 'nie gesehen'}
                        </Text>
                      )}
                    </VStack>
                  </HStack>
                </Link>
              </Box>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}

function DeviceTitle({
  deviceName,
  locationName,
  batteryMv,
}: {
  deviceName: string;
  locationName: string | undefined;
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
