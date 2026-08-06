import {Button, IconButton, Spinner} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {LuEllipsisVertical} from 'react-icons/lu';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '../chakra-snippets/menu';
import {toaster} from '../chakra-snippets/toaster';
import {
  assignNoiseDevice,
  assignableNoiseDevices,
  endNoiseAssignment,
} from '../../routes/crew.lautstaerke';

// Assigning is a menu rather than a dialog: picking the device *is* the whole
// input, so a form would add a schema and two taps for one choice. The section is
// already menu-driven (DeviceMenu, BluetoothMenu) and the device list is short.
export function AssignDeviceMenu({
  locationId,
  onAssigned,
}: {
  locationId: string;
  onAssigned: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  // Shares its key with the index's unassigned section, so one invalidation
  // after a move keeps both honest. Only fetched once the menu is opened —
  // every location card mounts one of these, and most page visits never open
  // any of them.
  const {data: devices, isPending} = useQuery({
    queryKey: ['assignableNoiseDevices'],
    queryFn: () => assignableNoiseDevices(),
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: (deviceId: string) =>
      assignNoiseDevice({data: {locationId, deviceId}}),
    onSuccess: async (_data, deviceId) => {
      await onAssigned();
      toaster.create({type: 'success', title: `${deviceId} zugewiesen`});
    },
    onError: (e) =>
      toaster.create({
        type: 'error',
        title: 'Zuweisung fehlgeschlagen',
        description: e instanceof Error ? e.message : String(e),
      }),
  });

  return (
    <MenuRoot open={open} onOpenChange={(e) => setOpen(e.open)}>
      <MenuTrigger asChild>
        <Button
          size="xs"
          variant="outline"
          flexShrink="0"
          loading={assign.isPending}
        >
          Gerät zuweisen
        </Button>
      </MenuTrigger>
      <MenuContent>
        {isPending ? (
          <MenuItem value="loading" disabled>
            <Spinner size="xs" />
          </MenuItem>
        ) : devices && devices.length > 0 ? (
          devices.map((d) => (
            <MenuItem
              key={d.id}
              value={d.id}
              fontFamily="mono"
              onClick={() => assign.mutate(d.id)}
            >
              {d.id}
            </MenuItem>
          ))
        ) : (
          <MenuItem value="none" disabled>
            Alle Geräte sind zugewiesen
          </MenuItem>
        )}
      </MenuContent>
    </MenuRoot>
  );
}

/** Ends an open assignment — the device leaves this location. */
export function AssignmentMenu({
  assignmentId,
  onEnded,
}: {
  assignmentId: string;
  onEnded: () => Promise<void> | void;
}) {
  const end = useMutation({
    mutationFn: () => endNoiseAssignment({data: {assignmentId}}),
    onSuccess: async () => {
      await onEnded();
      toaster.create({type: 'success', title: 'Zuweisung beendet'});
    },
    onError: (e) =>
      toaster.create({
        type: 'error',
        title: 'Zuweisung konnte nicht beendet werden',
        description: e instanceof Error ? e.message : String(e),
      }),
  });

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton
          aria-label="Zuweisung bearbeiten"
          rounded="full"
          size="sm"
          flexShrink="0"
          variant="ghost"
          loading={end.isPending}
        >
          <LuEllipsisVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        <MenuItem
          value="end"
          color="red.400"
          _hover={{bg: 'red.950', color: 'red.300'}}
          onClick={() => end.mutate()}
        >
          Zuweisung beenden
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}
