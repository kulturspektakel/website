import {Link as RouteLink} from '@tanstack/react-router';
import {Box, HStack, Span} from '@chakra-ui/react';
import {LuMapPin} from 'react-icons/lu';
import {Tooltip} from '../chakra-snippets/tooltip';
import {BatteryChip} from './BatteryChip';
import {Chip} from './Chip';
import {type DeviceAssignment} from './noise';
import {UploadsChip} from './UploadsChip';
import {WifiStatusIcon} from './WifiStatusIcon';
import {useBluetooth, useDeviceState} from './context';

// The chips beside a monitor's name: what its cell is at, where it is standing, and — while
// it is the monitor on the other end of this browser's Bluetooth — what it still has to
// upload and whether its WLAN is up. Whether it is reporting at all is the light on the name
// itself (see DevicePicker), which is where it belongs: it is a fact about the monitor rather
// than a reading from it.
//
// A leaf, because all but one of these come off the live store — read in the route instead,
// the subscription would wake the toolbar, both its dropdowns and its ⋮ menu once a second
// to redraw four chips. Same arrangement every other live readout in this section uses, and
// the same reason (see DeviceBadge, LocationReadings).
export function DeviceStatusLine({
  device,
  assignment,
}: {
  device: string;
  // Where it is placed, from the route's loader — the one thing here that isn't of *now*,
  // and absent for a monitor in a cupboard (see deviceAssignment).
  assignment?: DeviceAssignment | null;
}) {
  const deviceState = useDeviceState(device);
  const bluetooth = useBluetooth();
  const bleConnected = bluetooth.deviceName === device;
  // Pending uploads and WiFi status only make sense for the BLE-connected device.
  const pendingUploads = bleConnected ? bluetooth.pendingUploads : null;
  const wifiStatus = bleConnected ? bluetooth.wifiStatus : null;

  return (
    <HStack gap="2" flexShrink="0">
      {deviceState?.latest.batteryMv != null && (
        <BatteryChip mv={deviceState.latest.batteryMv} />
      )}
      {/* The stage, next to the charge — the two things a monitor's name needs qualifying
          by. Pressable, because the reading in context (this monitor against the others at
          that event) is a page away and this chip is the only thing here that knows which
          one. The event's name is the tooltip's: it would double the chip's width for a
          question nobody asks twice. */}
      {assignment && (
        <Tooltip content={assignment.projectName} showArrow>
          <Chip pressable asChild maxW="40" minW="0">
            <RouteLink
              to="/crew/lautstaerke/projekt/$projectId"
              params={{projectId: assignment.projectId}}
            >
              {/* A pin, so the chip says *place* without spending a word on it — beside a
                  voltage that looks much the same, a bare name would not say which of the
                  two kinds of fact it is. currentColor, so it goes white with the text when
                  the chip is pressed, and never shrinks: the name is what gives. */}
              <Box asChild flexShrink="0">
                <LuMapPin />
              </Box>
              <Span truncate minW="0">
                {assignment.locationName}
              </Span>
            </RouteLink>
          </Chip>
        </Tooltip>
      )}
      {pendingUploads != null && pendingUploads > 0 && (
        <UploadsChip count={pendingUploads} />
      )}
      {wifiStatus && <WifiStatusIcon status={wifiStatus} />}
    </HStack>
  );
}
