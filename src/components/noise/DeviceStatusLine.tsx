import {Link as RouteLink} from '@tanstack/react-router';
import {Box, HStack, Span} from '@chakra-ui/react';
import {LuMapPin} from 'react-icons/lu';
import {Tooltip} from '../chakra-snippets/tooltip';
import {BatteryChip} from './BatteryChip';
import {Chip} from './Chip';
import {type DeviceAssignment, formatSeen, isFresh, lastSeenAt} from './noise';
import {UploadsChip} from './UploadsChip';
import {WifiStatusIcon} from './WifiStatusIcon';
import {useBluetooth, useDeviceState, useTick} from './context';

// The chips beside a monitor's name: what its cell is at, where it is standing, and — while
// it is the monitor on the other end of this browser's Bluetooth — what it still has to
// upload and whether its Wi-Fi is up. Whether it is reporting at all is the light on the name
// itself (see DevicePicker), which is where it belongs: it is a fact about the monitor rather
// than a reading from it.
//
// And when it isn't reporting, since when — first in the line, where the light on the name
// would have been. The same pairing the picker's own rows use (see DevicePicker): one of the
// two, never both, because "reporting now" and "quiet since" are the same question asked
// either side of the dot going out, and a page about one instrument is opened to ask it.
// "Since when" is what separates a monitor somebody has just unplugged from one that has
// been down since yesterday, which the missing light alone cannot say.
//
// A leaf, because all but one of these come off the live store — read in the route instead,
// the subscription would wake the toolbar, both its dropdowns and its ⋮ menu once a second
// to redraw four chips. Same arrangement every other live readout in this section uses, and
// the same reason (see DeviceBadge, LocationReadings).
export function DeviceStatusLine({
  device,
  assignment,
  lastSeen,
}: {
  device: string;
  // Where it is placed, from the route's loader — the one thing here that isn't of *now*,
  // and absent for a monitor in a cupboard (see deviceAssignment).
  assignment?: DeviceAssignment | null;
  // What the record says about when it last reported, also from the loader: all a
  // freshly-opened page knows about a monitor that went quiet before it loaded, and merged
  // below with whatever has arrived since (see lastSeenAt).
  lastSeen?: number | null;
}) {
  const deviceState = useDeviceState(device);
  const bluetooth = useBluetooth();
  const now = useTick();
  const seen = lastSeenAt(lastSeen, deviceState?.lastSeen);
  const alive = isFresh(seen, now);
  const bleConnected = bluetooth.deviceName === device;
  // Pending uploads and WiFi status only make sense for the BLE-connected device.
  const pendingUploads = bleConnected ? bluetooth.pendingUploads : null;
  const wifiStatus = bleConnected ? bluetooth.wifiStatus : null;

  return (
    <HStack gap="2" flexShrink="0">
      {/* Plain muted text and not a chip: it qualifies the name beside it rather than
          standing as a reading of its own, and the chips after it are things the monitor
          is telling us — this is the note that it has stopped. Never shrinks and never
          wraps; it is a few words, and the name is what gives (see DevicePicker). */}
      {!alive && (
        <Span fontSize="xs" color="fg.muted" flexShrink="0" whiteSpace="nowrap">
          {formatSeen(seen, now)}
        </Span>
      )}
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
            {/* Straight to that stage's card, not to the project's front door: the chip
                names one place out of a dozen, and landing on somebody's remembered
                arrangement would leave you looking for it. Which place travels in the
                history entry rather than the URL — see locationSelection.ts — so the link
                is the plain list route, and the list makes it the one card on the page. */}
            <RouteLink
              to="/crew/noise/project/$projectId/list"
              params={{projectId: assignment.projectId}}
              state={{focusLocation: assignment.locationId}}
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
