import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {WifiDialog} from './WifiDialog';
import {useBluetooth} from './context';
import {useDeviceView} from './deviceView';

// Everything you can *do* to a monitor, behind the one ⋮ at the end of its toolbar: measure
// it against a reference microphone, and pair with it over Bluetooth and set up its Wi-Fi.
//
// Where it stands is not among them any more: that is a placement at an event, made in the
// project page's assignments dialog, and the free-text label this used to write was a
// second answer to the same question that no reading was ever filed under.
//
// What the page is *showing* is not in here — the weighting and the window are the
// toolbar's two dropdowns, beside this button. The menu used to carry them as
// submenus, and a timeframe item besides, from when this page had a historical view and
// no toolbar to put a picker in.
export function DeviceMenu({device}: {device: string}) {
  const bluetooth = useBluetooth();
  const {referenceMic} = useDeviceView();
  const navigate = useNavigate();
  const [wifiOpen, setWifiOpen] = useState(false);

  const bleConnected = bluetooth.deviceName != null;

  // Pairing lands you on the paired monitor's page: whichever device you have just
  // picked out of the browser's chooser is the one you meant to be looking at.
  const connectBle = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({
        to: '/crew/noise/device/$device',
        params: {device: name},
      });
    }
  };

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Device options"
            rounded="full"
            size="sm"
            flexShrink="0"
            variant="outline"
            loading={bluetooth.connecting}
          >
            <LuEllipsisVertical />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
          {/* The one item that belongs to the band chart rather than to the monitor: measuring
              it against a microphone on this computer, which draws a second spectrum over it
              while the panel is open. Dropped rather than disabled where the browser cannot
              capture at all, there being nothing behind it and nothing to go and enable.

              Calibration in the whole section means this one item: it measures what the
              monitor's per-band trims ought to be and, with Bluetooth connected, writes
              them. */}
          {referenceMic.supported && (
            <MenuItem
              value="reference-mic"
              onClick={() => {
                void referenceMic.open();
              }}
            >
              Calibration…
            </MenuItem>
          )}
          {/* Only under something: with no microphone to measure against, Bluetooth is the
              whole menu and there is nothing above it to separate from. */}
          {referenceMic.supported && <MenuSeparator />}

          {/* Bluetooth: connect while disconnected, else Wi-Fi/disconnect. The connect
              item always shows, but is disabled when the browser lacks Web Bluetooth
              support. Being connected implies support, so the Wi-Fi/disconnect branch
              needs no extra guard. */}
          {bleConnected ? (
            <>
              <MenuItem value="wifi" onClick={() => setWifiOpen(true)}>
                Set up Wi-Fi
              </MenuItem>
              <MenuItem
                value="disconnect"
                color="fg.error"
                _hover={{bg: 'bg.error', color: 'red.fg'}}
                onClick={() => {
                  void bluetooth.disconnect();
                }}
              >
                Disconnect Bluetooth
              </MenuItem>
            </>
          ) : (
            <MenuItem
              value="connect"
              disabled={!bluetooth.supported}
              onClick={() => {
                void connectBle();
              }}
            >
              Connect Bluetooth
            </MenuItem>
          )}
        </MenuContent>
      </MenuRoot>
      {bluetooth.deviceName != null && (
        <WifiDialog
          open={wifiOpen}
          onClose={() => setWifiOpen(false)}
          bluetooth={bluetooth}
          deviceName={bluetooth.deviceName}
        />
      )}
    </>
  );
}
