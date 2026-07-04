import {Link} from '@tanstack/react-router';
import {LuArrowLeft} from 'react-icons/lu';
import {Box, Button, HStack, Heading, IconButton, Text, VStack} from '@chakra-ui/react';
import {DayPicker} from './DayPicker';
import {BatteryChip} from './BatteryChip';
import {UploadsChip} from './UploadsChip';
import {WifiStatusIcon} from './WifiStatusIcon';
import {BluetoothMenu} from './BluetoothMenu';
import {isFresh, useLautstaerkeCtx, useTick} from './context';
import {useDeviceView} from './deviceView';

// Online dot. Ticks internally so only it (not the whole header) re-renders each
// second. Driven by live MQTT state, which is "is the device alive now" —
// independent of which day is being viewed, so it shows on every view. Turns
// blue while this device is the one connected over Bluetooth.
function LiveStatusDot({lastSeen, ble}: {lastSeen?: number; ble: boolean}) {
  const now = useTick();
  return (
    <Box
      w="3"
      h="3"
      rounded="full"
      flexShrink="0"
      bg={ble ? 'blue.500' : isFresh(lastSeen, now) ? 'green.500' : 'gray.400'}
    />
  );
}

// One header for both the live and historical device views. Everything but the
// loader-derived bits (location, day list, selected day) is read straight from
// the shared contexts, so the chrome is identical everywhere: the online dot,
// battery, and bluetooth chips reflect current device state regardless of view.
export function DeviceHeader({
  device,
  location,
  days,
  dayValue,
}: {
  device: string;
  location?: string | null;
  days: string[];
  // 'live' on the live view, or the yyyy-mm-dd on a historical view.
  dayValue: string;
}) {
  const ctx = useLautstaerkeCtx();
  const {weighting, toggleWeighting} = useDeviceView();
  const deviceState = ctx.devices[device];
  const bleConnected = ctx.bluetooth.deviceName === device;
  // Pending uploads and WiFi status only make sense for the BLE-connected device.
  const pendingUploads = bleConnected ? ctx.bluetooth.pendingUploads : null;
  const wifiStatus = bleConnected ? ctx.bluetooth.wifiStatus : null;

  return (
    <HStack mb="4" align="center">
      <IconButton
        asChild
        aria-label="Zurück zur Geräteliste"
        variant="ghost"
        size="sm"
      >
        <Link to="/crew/lautstaerke">
          <LuArrowLeft />
        </Link>
      </IconButton>
      <VStack align="start" gap="0" flex="1" minW="0">
        {location && (
          <Heading as="h1" size="2xl" truncate w="full">
            {location}
          </Heading>
        )}
        <HStack gap="2" minW="0" w="full">
          <LiveStatusDot lastSeen={deviceState?.lastSeen} ble={bleConnected} />
          {location ? (
            <Text fontFamily="mono" fontSize="sm" color="gray.500" truncate minW="0">
              {device}
            </Text>
          ) : (
            <Heading as="h1" size="2xl" fontFamily="mono" truncate minW="0">
              {device}
            </Heading>
          )}
          {deviceState?.batteryMv != null && (
            <BatteryChip mv={deviceState.batteryMv} />
          )}
          {pendingUploads != null && pendingUploads > 0 && (
            <UploadsChip count={pendingUploads} />
          )}
          {wifiStatus && <WifiStatusIcon status={wifiStatus} />}
        </HStack>
      </VStack>
      <BluetoothMenu />
      <DayPicker device={device} days={days} value={dayValue} />
      <Button
        size="sm"
        flexShrink="0"
        variant="outline"
        fontFamily="mono"
        minW={{base: 'auto', md: '20'}}
        onClick={toggleWeighting}
        aria-label={`Frequenzbewertung umschalten (aktuell dB(${weighting}))`}
      >
        {/* Just the weighting letter on mobile to save header space. */}
        <Text as="span" hideFrom="md">
          {weighting}
        </Text>
        <Text as="span" hideBelow="md">
          dB({weighting})
        </Text>
      </Button>
    </HStack>
  );
}
