import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {LuBluetooth} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {WifiDialog} from './WifiDialog';
import {useBluetooth} from './context';

// Owns the whole Bluetooth lifecycle, shared by the overview and device views.
// While disconnected the button connects directly (and on success we jump to
// the connected device's detail page); once connected it becomes a dropdown
// offering Wi-Fi setup and disconnect. The trigger is blue while connected.
export function BluetoothMenu() {
  const bluetooth = useBluetooth();
  const navigate = useNavigate();
  const [wifiOpen, setWifiOpen] = useState(false);

  if (!bluetooth.supported) return null;

  const connect = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({
        to: '/crew/noise/device/$device',
        params: {device: name},
      });
    }
  };

  if (bluetooth.deviceName == null) {
    return (
      <IconButton
        aria-label="Connect Bluetooth"
        rounded="full"
        size="sm"
        flexShrink="0"
        variant="outline"
        loading={bluetooth.connecting}
        onClick={() => {
          void connect();
        }}
      >
        <LuBluetooth />
      </IconButton>
    );
  }

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <IconButton
            aria-label="Bluetooth"
            rounded="full"
            size="sm"
            flexShrink="0"
            colorPalette="blue"
            variant="solid"
          >
            <LuBluetooth />
          </IconButton>
        </MenuTrigger>
        <MenuContent>
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
            Disconnect
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <WifiDialog
        open={wifiOpen}
        onClose={() => setWifiOpen(false)}
        bluetooth={bluetooth}
        deviceName={bluetooth.deviceName}
      />
    </>
  );
}
