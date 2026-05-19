import {createFileRoute, Link} from '@tanstack/react-router';
import {
  Box,
  Center,
  HStack,
  Heading,
  IconButton,
  Menu,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import {LuBluetooth} from 'react-icons/lu';
import {
  decodeDb,
  isFresh,
  useLautstaerkeCtx,
  useTick,
  type BluetoothSlice,
} from '../lautstaerke/context';
import {BatteryChip} from '../lautstaerke/BatteryChip';
import {BluetoothChip} from '../lautstaerke/BluetoothChip';

export const Route = createFileRoute('/crew/lautstaerke/')({
  component: DeviceList,
});

function DeviceList() {
  const ctx = useLautstaerkeCtx();
  const now = useTick();
  const names = Object.keys(ctx.devices).sort();

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
        <Text color="gray.500">Noch keine Geräte empfangen.</Text>
      ) : (
        <VStack align="stretch" gap="2">
          {names.map((name) => {
            const state = ctx.devices[name];
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
                      bg={
                        isFresh(state.lastSeen, now) ? 'green.500' : 'gray.400'
                      }
                    />
                    <DeviceTitle
                      deviceName={name}
                      locationName={ctx.deviceLocations[name]}
                      batteryMv={state.batteryMv}
                    />
                    {ctx.bluetooth.deviceName === name && <BluetoothChip />}
                    <VStack gap="1" align="end" minW="0">
                      <Text fontFamily="mono" fontWeight="bold" lineHeight="1">
                        {decodeDb(state.latest.laeq1s).toFixed(1)} dB(A)
                      </Text>
                      <Text
                        fontFamily="mono"
                        fontSize="xs"
                        color="gray.500"
                        lineHeight="1"
                      >
                        {state.laeq30m != null
                          ? `${decodeDb(state.laeq30m).toFixed(1)} dB(A) 30m`
                          : '— 30m'}
                      </Text>
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
      <Menu.Root positioning={{placement: 'bottom-end'}}>
        <Menu.Trigger asChild>
          <HStack
            as="button"
            gap="2"
            px="2"
            py="1"
            rounded="md"
            borderWidth="1px"
            borderColor="blue.500"
            bg="blue.950"
            cursor="pointer"
            _hover={{bg: 'blue.900'}}
          >
            <Box w="2" h="2" rounded="full" bg="blue.500" />
            <Text fontSize="sm" fontFamily="mono">
              {bluetooth.deviceName}
            </Text>
          </HStack>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item
              value="calibrate"
              onClick={() => {
                void calibratePrompt(bluetooth);
              }}
            >
              Kalibrierung…
            </Menu.Item>
            <Menu.Item
              value="wifi"
              onClick={() => {
                void wifiPrompt(bluetooth);
              }}
            >
              WLAN…
            </Menu.Item>
            <Menu.Item
              value="disconnect"
              onClick={() => {
                void bluetooth.disconnect();
              }}
            >
              Trennen
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
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

async function calibratePrompt(bluetooth: BluetoothSlice) {
  let current: number | null = null;
  try {
    current = await bluetooth.readCalibrationDb();
  } catch (e) {
    alert(`Kalibrierung lesen fehlgeschlagen: ${errorMessage(e)}`);
    return;
  }
  const input = window.prompt(
    `Kalibrierungs-Offset in dB (aktuell ${current.toFixed(2)}):`,
    current.toFixed(2),
  );
  if (input == null) return;
  const trimmed = input.trim().replace(',', '.');
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    alert(`Ungültiger Wert: "${input}"`);
    return;
  }
  try {
    await bluetooth.writeCalibrationDb(value);
  } catch (e) {
    alert(`Kalibrierung schreiben fehlgeschlagen: ${errorMessage(e)}`);
  }
}

async function wifiPrompt(bluetooth: BluetoothSlice) {
  const ssid = window.prompt('WLAN-Name (SSID):');
  if (ssid == null) return;
  if (ssid.length === 0) {
    alert('SSID darf nicht leer sein.');
    return;
  }
  const password = window.prompt(`Passwort für "${ssid}" (leer für offen):`);
  if (password == null) return;
  try {
    await bluetooth.writeWifiCredentials(ssid, password);
    alert('WLAN-Daten gespeichert. Gerät startet neu.');
  } catch (e) {
    // The device reboots almost immediately after acking the write, so a
    // GATT disconnect surfacing here is the expected success path.
    const msg = errorMessage(e);
    if (/disconnected|gatt/i.test(msg)) {
      alert('WLAN-Daten gespeichert. Gerät startet neu.');
    } else {
      alert(`WLAN schreiben fehlgeschlagen: ${msg}`);
    }
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
