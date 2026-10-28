import {type ReactNode, useEffect, useRef, useState} from 'react';
import {useLocation, useNavigate} from '@tanstack/react-router';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTriggerItem,
} from '../chakra-snippets/menu';
import {useBluetooth} from './context';
import {useDeviceView} from './deviceView';
import {useConnectDevice} from './useConnectDevice';
import {WifiDialog} from './WifiDialog';

// The things you can do *to* a monitor that open something on its page: measure it against a
// reference microphone, and give it a Wi-Fi network. One list, and one answer to what each
// opens, so the monitor's own ⋮ (see DeviceMenu) and a location's (see LocationCard) offer
// the same things under the same names, in the same order, and do the same thing with them.
//
// Both happen on the monitor's page, whichever menu they were picked from: the calibration
// panel lives there (see ReferenceMicPanel), and so does everything useDeviceActions opens. A
// location's menu therefore only navigates (see useDeviceActionRedirect), carrying the action
// in the history entry, and the page runs it on arrival.
export const DEVICE_ACTIONS = [
  {id: 'calibration', label: 'Calibration'},
  {id: 'wifi', label: 'Set up Wi-Fi'},
] as const;

export type DeviceAction = (typeof DEVICE_ACTIONS)[number]['id'];

// Carried by a navigation to a monitor's page: the action to run once it is there. History
// state rather than the URL, for the reason the map's errands are (see the map view): it is
// what you came to do, not a view anyone would link to.
declare module '@tanstack/history' {
  interface HistoryState {
    deviceAction?: DeviceAction;
  }
}

/**
 * What each action does, for the monitor whose page this is — and the dialogs it opens, for
 * the caller to render (`dialogs`).
 *
 * Calibration opens the reference-microphone panel, which the route renders itself (see
 * the device route for why it, and not a menu, owns that). Wi-Fi credentials can only reach
 * the monitor over Bluetooth, but that is a step on the way rather than a precondition to go
 * and meet elsewhere — so without this monitor connected, running it connects first (see
 * useConnectDevice) and the dialog opens once it is.
 *
 * Also runs the action a location's menu sent you here with (see useDeviceActionRedirect) —
 * once per history entry, so closing what it opened does not reopen it, and a second monitor
 * reached the same way while the page stays mounted still gets its own. It waits for the
 * action to be available, which both slices work out in an effect of their own, and then
 * takes it off the entry, so a reload or a back to the page is the page and not the errand
 * again. Written to the browser's history directly rather than through the router: a router
 * replace is a navigation, and would re-run the loader to change nothing on screen. The
 * router's copy keeps it until the next navigation, which is what the ref is for.
 *
 * Wi-Fi without a connection still has to raise the browser's Bluetooth chooser, which it will
 * only do so soon after a click — the one that navigated here — so that is the arrival that
 * can land on "Bluetooth connection failed" instead, from which the menu item is the way on.
 */
export function useDeviceActions(device: string): {
  // False for an action this browser could never run — no capture, no Bluetooth.
  isAvailable: (action: DeviceAction) => boolean;
  run: (action: DeviceAction) => void;
  dialogs: ReactNode;
} {
  const bluetooth = useBluetooth();
  const {referenceMic} = useDeviceView();
  const {connected, connect} = useConnectDevice(device);
  const [wifiOpen, setWifiOpen] = useState(false);

  const isAvailable = (action: DeviceAction) =>
    action === 'calibration'
      ? referenceMic.supported
      : connected || bluetooth.supported;
  const run = (action: DeviceAction) => {
    if (action === 'calibration') {
      void referenceMic.open();
    } else {
      void connect().then((ok) => {
        if (ok) setWifiOpen(true);
      });
    }
  };

  const arrival = useLocation({
    select: (l) =>
      l.state.deviceAction == null
        ? null
        : {action: l.state.deviceAction, entry: l.state.__TSR_key ?? l.href},
    structuralSharing: true,
  });
  const ranArrival = useRef<string | null>(null);
  const arrivalReady = arrival != null && isAvailable(arrival.action);
  useEffect(() => {
    if (!arrival || !arrivalReady || ranArrival.current === arrival.entry)
      return;
    ranArrival.current = arrival.entry;
    window.history.replaceState(
      {...window.history.state, deviceAction: undefined},
      '',
    );
    run(arrival.action);
    // Keyed on the entry and the readiness only: `run` is a fresh closure each render, and
    // the ref is what stops it running twice.
  }, [arrival?.entry, arrivalReady]);

  return {
    isAvailable,
    run,
    // Only while connected, because the dialog writes over the connection — and since it is
    // only opened once this monitor is the one connected, that is the monitor it names.
    dialogs: bluetooth.deviceName != null && (
      <WifiDialog
        open={wifiOpen}
        onClose={() => setWifiOpen(false)}
        bluetooth={bluetooth}
        deviceName={bluetooth.deviceName}
      />
    ),
  };
}

/**
 * The same actions from anywhere other than the monitor's page: off to it, with the action
 * to run there once it has loaded (see useDeviceActions).
 */
export function useDeviceActionRedirect(): (
  action: DeviceAction,
  device: string,
) => void {
  const navigate = useNavigate();
  return (deviceAction, device) => {
    void navigate({
      to: '/crew/noise/device/$device',
      params: {device},
      state: {deviceAction},
    });
  };
}

/**
 * The actions as menu items, for one monitor or for several.
 *
 * One monitor is an item per action, with the ellipsis — each opens something. Several (a
 * location that has had more than one) is a submenu per action listing them, which is the
 * question asked in the order it is answered: what to do, then to which.
 */
export function DeviceActionItems({
  devices,
  onSelect,
  isAvailable,
}: {
  devices: readonly string[];
  onSelect: (action: DeviceAction, device: string) => void;
  // Dropped rather than disabled where false — for an action the page knows it could never
  // run, such as a calibration in a browser that cannot capture.
  isAvailable?: (action: DeviceAction) => boolean;
}) {
  const actions = DEVICE_ACTIONS.filter((a) => isAvailable?.(a.id) ?? true);
  if (devices.length === 0) return null;
  if (devices.length === 1) {
    const device = devices[0]!;
    return actions.map((action) => (
      <MenuItem
        key={action.id}
        value={action.id}
        onClick={() => onSelect(action.id, device)}
      >
        {action.label}…
      </MenuItem>
    ));
  }
  return actions.map((action) => (
    <MenuRoot
      key={action.id}
      positioning={{placement: 'right-start', gutter: 2}}
    >
      <MenuTriggerItem value={action.id}>{action.label}</MenuTriggerItem>
      <MenuContent>
        {devices.map((device) => (
          <MenuItem
            key={device}
            value={`${action.id}-${device}`}
            onClick={() => onSelect(action.id, device)}
          >
            {device}…
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  ));
}
