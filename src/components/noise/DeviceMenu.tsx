import {useNavigate, useRouter} from '@tanstack/react-router';
import {useMutation} from '@tanstack/react-query';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {IconButton} from '@chakra-ui/react';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  MenuTriggerItem,
} from '../chakra-snippets/menu';
import {toaster} from '../chakra-snippets/toaster';
import {assignNoiseDevice} from '../../routes/crew.noise';
import {errorToast} from '../toast';
import {DeviceLimitsDialog} from './LocationLimitsDialog';
import {useBluetooth} from './context';
import {useDeviceView} from './deviceView';
import {DeviceActionItems, useDeviceActions} from './deviceActions';
import type {DeviceAssignment} from './noise';

// Everything you can *do* to a monitor, behind the one ⋮ at the end of its toolbar: edit
// the limits of the place it is standing at (or, standing nowhere, put it somewhere), measure
// it against a reference microphone, and set up its Wi-Fi (see deviceActions). Disconnecting
// Bluetooth is not in here: the connection outlives this page, so the way to end it is the
// toast that stays up for as long as it does (see useBleDevice).
//
// Where it stands is not edited here: that is a placement at an event, made on the event's
// own page — this only takes you there — and the free-text label this used to write was a
// second answer to the same question that no reading was ever filed under.
//
// What the page is *showing* is not in here — the weighting and the window are the
// toolbar's two dropdowns, beside this button. The menu used to carry them as
// submenus, and a timeframe item besides, from when this page had a historical view and
// no toolbar to put a picker in.
export function DeviceMenu({
  device,
  assignment,
  activeProjects,
}: {
  device: string;
  // Where the monitor is standing right now, if anywhere — whose limits the first item
  // edits, and which are the rules drawn over the chart below.
  assignment: DeviceAssignment | null;
  // The events running now and the places at each, while it is standing nowhere — where
  // it could be put to work. Empty once it is placed.
  activeProjects: readonly {
    id: string;
    name: string;
    locations: readonly {id: string; locationName: string}[];
  }[];
}) {
  const bluetooth = useBluetooth();
  const {picked, referenceMic} = useDeviceView();
  const navigate = useNavigate();
  const [limitsOpen, setLimitsOpen] = useState(false);
  const router = useRouter();
  // Straight to the server from the menu: the place is the whole answer, and it is standing
  // there from now. Not the event's start, which the dialogs default to: this is only
  // offered while the monitor stands nowhere, so whatever it read before this press — in a
  // cupboard, or at a place it has since left — was not this place's. The page's loader is
  // what knows where it stands, so it is re-run rather than patched.
  const assign = useMutation({
    mutationFn: (location: {id: string; locationName: string}) =>
      assignNoiseDevice({
        data: {locationId: location.id, deviceId: device, start: Date.now()},
      }),
    onSuccess: async (_, location) => {
      await router.invalidate();
      toaster.create({
        type: 'success',
        title: `Assigned to ${location.locationName}`,
      });
    },
    onError: errorToast('Device could not be assigned'),
  });

  // Calibration and Wi-Fi, shared with a location's menu (see deviceActions).
  const actions = useDeviceActions(device);

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
          {/* The same dialog the location's card opens on the project page: the limits are
              the place's and not the monitor's, so this is only here while it is standing
              somewhere, and it edits that place's for everyone stood there. */}
          {assignment && (
            <>
              <MenuItem value="limits" onClick={() => setLimitsOpen(true)}>
                Manage limits…
              </MenuItem>
              <MenuSeparator />
            </>
          )}
          {/* Standing nowhere while an event is on: put it somewhere. One entry per
              event, named for it only when there is more than one to tell apart.

              Where the event already has places, the entry opens a list of them — a press
              assigns the monitor there and then, from now (see `assign`), and this page
              reloads standing there. The
              list ends on a new place, as does the entry itself when there are none to
              list: a location is a pin on the event's map, so that goes there with the
              create tool armed, taking the monitor along in the history entry so the map
              can preselect it and bring you back here once it is placed (see the map
              view). */}
          {activeProjects.length > 0 && (
            <>
              {activeProjects.map((project) => {
                const label =
                  activeProjects.length > 1
                    ? `Assign to location at ${project.name}`
                    : 'Assign to location';
                const placeNew = () => {
                  void navigate({
                    to: '/crew/noise/project/$projectId/map',
                    params: {projectId: project.id},
                    state: {assignDevice: device, placeLocation: true},
                  });
                };
                return project.locations.length === 0 ? (
                  <MenuItem
                    key={project.id}
                    value={`assign-${project.id}`}
                    onClick={placeNew}
                  >
                    {label}…
                  </MenuItem>
                ) : (
                  <MenuRoot
                    key={project.id}
                    positioning={{placement: 'right-start', gutter: 2}}
                  >
                    <MenuTriggerItem value={`assign-${project.id}`}>
                      {label}
                    </MenuTriggerItem>
                    <MenuContent>
                      {project.locations.map((location) => (
                        <MenuItem
                          key={location.id}
                          value={location.id}
                          disabled={assign.isPending}
                          onClick={() => assign.mutate(location)}
                        >
                          {location.locationName}
                        </MenuItem>
                      ))}
                      <MenuSeparator />
                      <MenuItem value={`new-${project.id}`} onClick={placeNew}>
                        New location…
                      </MenuItem>
                    </MenuContent>
                  </MenuRoot>
                );
              })}
              <MenuSeparator />
            </>
          )}
          {/* What can be done to this monitor that opens something here — the same list a
              location's ⋮ offers, which sends you here to run it (see deviceActions).

              Calibration measures it against a microphone on this computer, which draws a
              second spectrum over the band chart while the panel is open, and works out what
              its per-band trims ought to be. Wi-Fi credentials can only reach it over
              Bluetooth, but that is a step on the way rather than a precondition to go and
              meet elsewhere — so without this monitor connected, the press connects it first
              (see useConnectDevice) and the dialog opens once it is.

              Each is dropped where the browser could never do it — no capture, no Bluetooth —
              there being nothing behind it and nothing to go and enable. */}
          <DeviceActionItems
            devices={[device]}
            onSelect={actions.run}
            isAvailable={actions.isAvailable}
          />
        </MenuContent>
      </MenuRoot>
      {actions.dialogs}
      {assignment && (
        <DeviceLimitsDialog
          open={limitsOpen}
          onClose={() => setLimitsOpen(false)}
          assignment={assignment}
          picked={picked}
        />
      )}
    </>
  );
}
