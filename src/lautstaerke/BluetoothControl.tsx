import {Box, HStack, IconButton, Menu, Text} from '@chakra-ui/react';
import {LuBluetooth} from 'react-icons/lu';
import {toaster} from '../components/chakra-snippets/toaster';
import {useLautstaerkeCtx, type BluetoothSlice} from './context';

export function BluetoothControl() {
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
    toaster.create({
      type: 'error',
      title: 'Kalibrierung lesen fehlgeschlagen',
      description: errorMessage(e),
    });
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
    toaster.create({type: 'error', title: `Ungültiger Wert: "${input}"`});
    return;
  }
  try {
    await bluetooth.writeCalibrationDb(value);
    toaster.create({type: 'success', title: 'Kalibrierung gespeichert'});
  } catch (e) {
    toaster.create({
      type: 'error',
      title: 'Kalibrierung schreiben fehlgeschlagen',
      description: errorMessage(e),
    });
  }
}

async function wifiPrompt(bluetooth: BluetoothSlice) {
  const ssid = window.prompt('WLAN-Name (SSID):');
  if (ssid == null) return;
  if (ssid.length === 0) {
    toaster.create({type: 'error', title: 'SSID darf nicht leer sein.'});
    return;
  }
  const password = window.prompt(`Passwort für "${ssid}" (leer für offen):`);
  if (password == null) return;
  try {
    await bluetooth.writeWifiCredentials(ssid, password);
    toaster.create({
      type: 'success',
      title: 'WLAN-Daten gespeichert',
      description: 'Gerät startet neu.',
    });
  } catch (e) {
    // The device reboots almost immediately after acking the write, so a
    // GATT disconnect surfacing here is the expected success path.
    const msg = errorMessage(e);
    if (/disconnected|gatt/i.test(msg)) {
      toaster.create({
        type: 'success',
        title: 'WLAN-Daten gespeichert',
        description: 'Gerät startet neu.',
      });
    } else {
      toaster.create({
        type: 'error',
        title: 'WLAN schreiben fehlgeschlagen',
        description: msg,
      });
    }
  }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
