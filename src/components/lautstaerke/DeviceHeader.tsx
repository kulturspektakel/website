import {Link} from '@tanstack/react-router';
import {LuArrowLeft} from 'react-icons/lu';
import {HStack, Heading, IconButton, Text, VStack} from '@chakra-ui/react';
import {BatteryChip} from './BatteryChip';
import {UploadsChip} from './UploadsChip';
import {WifiStatusIcon} from './WifiStatusIcon';
import {DeviceMenu} from './DeviceMenu';
import {LiveStatusDot} from './LiveStatusDot';
import {useBluetooth, useNoiseLive} from './context';

// One header for both the live and historical device views. Everything but the
// loader-derived location is read straight from the shared contexts (or, for the
// viewed timeframe, from the URL), so the chrome is identical everywhere: the
// battery, and bluetooth chips reflect current device state regardless of view.
export function DeviceHeader({
  device,
  location,
}: {
  device: string;
  location?: string | null;
}) {
  const ctx = useNoiseLive();
  const bluetooth = useBluetooth();
  const deviceState = ctx.devices[device];
  const bleConnected = bluetooth.deviceName === device;
  // Pending uploads and WiFi status only make sense for the BLE-connected device.
  const pendingUploads = bleConnected ? bluetooth.pendingUploads : null;
  const wifiStatus = bleConnected ? bluetooth.wifiStatus : null;

  return (
    <HStack mb="4" align="center">
      <IconButton
        asChild
        aria-label="Zurück zur Projektliste"
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
            <Text fontSize="sm" color="gray.500" truncate minW="0">
              {device}
            </Text>
          ) : (
            <Heading as="h1" size="2xl" truncate minW="0">
              {device}
            </Heading>
          )}
          {deviceState?.latest.batteryMv != null && (
            <BatteryChip mv={deviceState.latest.batteryMv} />
          )}
          {pendingUploads != null && pendingUploads > 0 && (
            <UploadsChip count={pendingUploads} />
          )}
          {wifiStatus && <WifiStatusIcon status={wifiStatus} />}
        </HStack>
      </VStack>
      <DeviceMenu device={device} currentLocation={location} />
    </HStack>
  );
}
