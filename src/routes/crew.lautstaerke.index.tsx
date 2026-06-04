import {createFileRoute, Link} from '@tanstack/react-router';
import {
  Box,
  Button,
  Center,
  HStack,
  Heading,
  IconButton,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import {LuBluetooth} from 'react-icons/lu';
import {
  decodeDb,
  formatLastSeen,
  isFresh,
  useLautstaerkeCtx,
  useTick,
} from '../components/lautstaerke/context';
import {BatteryChip} from '../components/lautstaerke/BatteryChip';
import {BluetoothChip} from '../components/lautstaerke/BluetoothChip';

export const Route = createFileRoute('/crew/lautstaerke/')({
  component: DeviceList,
});

function DeviceList() {
  const ctx = useLautstaerkeCtx();
  const now = useTick();
  // DB-registered devices are always listed; devices first seen via MQTT are
  // added on the fly so newly discovered monitors show up without a DB entry.
  // Ordering: active (recently seen) devices first, then by location name,
  // then by device name as the final tie-breaker.
  const names = [
    ...new Set([...ctx.deviceIds, ...Object.keys(ctx.devices)]),
  ].sort((a, b) => {
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
        <BluetoothControl />
      </HStack>
      {ctx.bluetooth.error && (
        <Text color="red.500" mb="3" fontSize="sm">
          {ctx.bluetooth.error}
        </Text>
      )}
      {names.length === 0 && !ctx.connected ? (
        <Center flex="1" py="10">
          <Spinner size="lg" />
        </Center>
      ) : names.length === 0 ? (
        <Text color="gray.500">Keine Lärmmessgeräte registriert.</Text>
      ) : (
        <VStack align="stretch" gap="2">
          {names.map((name) => {
            const state = ctx.devices[name];
            const active = isFresh(state?.lastSeen, now);
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
                      bg={active ? 'green.500' : 'gray.400'}
                    />
                    <DeviceTitle
                      deviceName={name}
                      locationName={ctx.deviceLocations[name]}
                      batteryMv={state?.batteryMv}
                    />
                    {ctx.bluetooth.deviceName === name && <BluetoothChip />}
                    <VStack gap="1" align="end" minW="0">
                      {active ? (
                        <>
                          <Text
                            fontFamily="mono"
                            fontWeight="bold"
                            lineHeight="1"
                          >
                            {decodeDb(state!.latest.laeq1s).toFixed(1)} dB(A)
                          </Text>
                          <Text
                            fontFamily="mono"
                            fontSize="xs"
                            color="gray.500"
                            lineHeight="1"
                          >
                            {state!.laeq5m == null
                              ? '— dB(A) 5m'
                              : `${decodeDb(state!.laeq5m).toFixed(1)} dB(A) 5m`}
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

function BluetoothControl() {
  const {bluetooth} = useLautstaerkeCtx();
  if (!bluetooth.supported) return null;
  if (bluetooth.deviceName) {
    return (
      <HStack
        gap="2"
        px="2"
        py="1"
        rounded="md"
        borderWidth="1px"
        borderColor="blue.500"
        bg="blue.950"
      >
        <Box w="2" h="2" rounded="full" bg="blue.500" />
        <Text fontSize="sm" fontFamily="mono">
          {bluetooth.deviceName}
        </Text>
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            void bluetooth.disconnect();
          }}
        >
          Trennen
        </Button>
      </HStack>
    );
  }
  return (
    <IconButton
      aria-label="Bluetooth verbinden"
      rounded="full"
      size="sm"
      onClick={() => {
        void bluetooth.connect();
      }}
      loading={bluetooth.connecting}
    >
      <LuBluetooth />
    </IconButton>
  );
}
