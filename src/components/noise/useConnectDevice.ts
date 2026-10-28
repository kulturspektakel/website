import {useCallback} from 'react';
import {toaster} from '../chakra-snippets/toaster';
import {useBluetooth} from './context';

/**
 * One monitor over Bluetooth, for a page that is about that monitor and is about to write
 * something to it — a calibration (see ReferenceMicPanel), Wi-Fi credentials (see
 * DeviceMenu).
 *
 * `connected` is whether *this* monitor is on the other end, not merely whether something is:
 * the write paths only check that a connection exists (see useBleDevice), so a looser test
 * would quietly write to whichever monitor happened to be paired.
 *
 * `connect` resolves true once it is. The browser's chooser is narrowed to this monitor's name,
 * and the name is checked again on the way back all the same — the filter is the browser's to
 * honour, and the write that follows is the thing that matters. A different monitor already
 * paired is dropped by the connect (see useBleDevice).
 */
export function useConnectDevice(device: string) {
  const bluetooth = useBluetooth();
  const connected = bluetooth.deviceName === device;
  const {connect: bleConnect} = bluetooth;
  const connect = useCallback(async (): Promise<boolean> => {
    if (connected) return true;
    const name = await bleConnect(device);
    // Cancelled, or failed — which connect has already said, if it was worth saying.
    if (name == null) return false;
    if (name !== device) {
      toaster.create({
        type: 'error',
        title: 'Wrong device',
        description: `Connected to ${name} instead of ${device}.`,
      });
      return false;
    }
    return true;
  }, [connected, bleConnect, device]);
  return {connected, connect};
}
