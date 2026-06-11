import {useNavigate} from '@tanstack/react-router';
import {useState} from 'react';
import {LuBluetooth} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {MenuContent, MenuItem, MenuRoot, MenuTrigger} from '../chakra-snippets/menu';
import {CalibrationDialog} from './CalibrationDialog';
import {useLautstaerkeCtx} from './context';

// Owns the whole Bluetooth lifecycle, shared by the overview and device views.
// While disconnected the button connects directly (and on success we jump to
// the connected device's detail page); once connected it becomes a dropdown
// offering calibration and disconnect. The trigger is blue while connected.
export function BluetoothMenu() {
  const {bluetooth} = useLautstaerkeCtx();
  const navigate = useNavigate();
  const [calibrating, setCalibrating] = useState(false);

  if (!bluetooth.supported) return null;

  const connect = async () => {
    const name = await bluetooth.connect();
    if (name) {
      void navigate({to: '/crew/lautstaerke/$device', params: {device: name}});
    }
  };

  if (bluetooth.deviceName == null) {
    return (
      <IconButton
        aria-label="Bluetooth verbinden"
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
          <MenuItem value="calibrate" onClick={() => setCalibrating(true)}>
            Kalibrieren
          </MenuItem>
          <MenuItem
            value="disconnect"
            color="red.400"
            _hover={{bg: 'red.950', color: 'red.300'}}
            onClick={() => {
              void bluetooth.disconnect();
            }}
          >
            Trennen
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      <CalibrationDialog
        open={calibrating}
        onClose={() => setCalibrating(false)}
        bluetooth={bluetooth}
        deviceName={bluetooth.deviceName}
      />
    </>
  );
}
