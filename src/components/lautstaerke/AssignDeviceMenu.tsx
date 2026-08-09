import {Button, IconButton, Spinner} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
  MenuTriggerItem,
} from '../chakra-snippets/menu';
import {toaster} from '../chakra-snippets/toaster';
import {errorToast} from './toast';
import {noiseQueryKeys} from './queries';
import {
  assignNoiseDevice,
  assignableNoiseDevices,
  endNoiseAssignment,
} from '../../routes/crew.lautstaerke';

// Assigning is a menu rather than a dialog: picking the device *is* the whole
// input, so a form would add a schema and two taps for one choice. The section is
// already menu-driven (DeviceMenu, BluetoothMenu) and the device list is short.
//
// A location has two actions — assign a monitor, remove one that is standing there —
// and a card that has nothing assigned yet has only the first, under a labelled button
// rather than a ⋮ nobody would open. So what each action does lives in a hook and what
// it offers in an item, and the two menus here are triggers around the same parts.
export function AssignDeviceMenu({
  locationId,
  onAssigned,
}: {
  locationId: string;
  onAssigned: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const assign = useAssignDevice({locationId, onAssigned, enabled: open});

  return (
    <MenuRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
      <MenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          flexShrink="0"
          loading={assign.mutation.isPending}
        >
          Gerät zuweisen
        </Button>
      </MenuTrigger>
      <MenuContent>
        <AssignDeviceItems {...assign} />
      </MenuContent>
    </MenuRoot>
  );
}

// Everything a location's monitors can be done to, in one ⋮: a location has one row
// and no per-device ones, so this is the only place either action can hang off.
//
// `assignments` is the open ones — you cannot end an assignment twice, so one you
// scrubbed back to is listed on the row but not offered here, and a card whose
// monitors have all moved on is left with the assign submenu alone.
export function LocationDeviceMenu({
  locationId,
  assignments,
  onChanged,
}: {
  locationId: string;
  assignments: Array<{id: string; deviceId: string}>;
  onChanged: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const assign = useAssignDevice({
    locationId,
    onAssigned: onChanged,
    enabled: open,
  });
  const end = useEndAssignment(onChanged);

  return (
    <MenuRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
      <MenuTrigger asChild>
        <IconButton
          aria-label="Zuweisungen bearbeiten"
          rounded="full"
          size="sm"
          flexShrink="0"
          variant="ghost"
          loading={assign.mutation.isPending || end.isPending}
        >
          <LuEllipsisVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        {/* A submenu rather than the device ids loose at the top level: they would
            otherwise sit unlabelled next to a destructive item, and this keeps the
            wording the card's button has everywhere else. */}
        <MenuRoot positioning={{placement: 'left-start', gutter: 2}}>
          <MenuTriggerItem value="assign">Gerät zuweisen</MenuTriggerItem>
          <MenuContent>
            <AssignDeviceItems {...assign} />
          </MenuContent>
        </MenuRoot>
        {assignments.length > 0 && <MenuSeparator />}
        {/* One item per monitor, named — with several standing here, "Zuweisung
            beenden" would not say which one it was about, and a submenu to pick in
            would bury the commonest action of the two behind a hover. */}
        {assignments.map(({id, deviceId}) => (
          <MenuItem
            key={id}
            value={`end-${id}`}
            color="red.400"
            _hover={{bg: 'red.950', color: 'red.300'}}
            onClick={() => end.mutate(id)}
          >
            {deviceId} entfernen
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

// The assignable monitors and the mutation that moves one here. Shares its query key
// with the index's unassigned section, so one invalidation after a move keeps both
// honest. Only fetched once the menu is opened — every location card mounts one of
// these, and most page visits never open any of them.
function useAssignDevice({
  locationId,
  onAssigned,
  enabled,
}: {
  locationId: string;
  onAssigned: () => Promise<void> | void;
  enabled: boolean;
}) {
  const {data: devices, isPending} = useQuery({
    queryKey: noiseQueryKeys.assignableDevices,
    queryFn: () => assignableNoiseDevices(),
    enabled,
  });

  const mutation = useMutation({
    mutationFn: (deviceId: string) =>
      assignNoiseDevice({data: {locationId, deviceId}}),
    onSuccess: async (_data, deviceId) => {
      await onAssigned();
      toaster.create({type: 'success', title: `${deviceId} zugewiesen`});
    },
    onError: errorToast('Zuweisung fehlgeschlagen'),
  });

  return {devices, isPending, mutation};
}

function AssignDeviceItems({
  devices,
  isPending,
  mutation,
}: ReturnType<typeof useAssignDevice>) {
  if (isPending) {
    return (
      <MenuItem value="loading" disabled>
        <Spinner size="xs" />
      </MenuItem>
    );
  }
  if (!devices || devices.length === 0) {
    return (
      <MenuItem value="none" disabled>
        Alle Geräte sind zugewiesen
      </MenuItem>
    );
  }
  return devices.map((d) => (
    <MenuItem key={d.id} value={d.id} onClick={() => mutation.mutate(d.id)}>
      {d.id}
    </MenuItem>
  ));
}

// Which assignment to end is a mutation variable rather than a hook argument, so a
// menu that only sometimes offers the item doesn't have to invent an id to hold the
// hook's shape.
function useEndAssignment(onEnded: () => Promise<void> | void) {
  return useMutation({
    mutationFn: (assignmentId: string) =>
      endNoiseAssignment({data: {assignmentId}}),
    onSuccess: async () => {
      await onEnded();
      toaster.create({type: 'success', title: 'Zuweisung beendet'});
    },
    onError: errorToast('Zuweisung konnte nicht beendet werden'),
  });
}
