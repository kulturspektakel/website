import {Button, Field} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {useState} from 'react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {assignNoiseDevice} from '../../routes/crew.noise';
import {errorToast} from '../toast';
import {Name} from './Name';
import {TimeField} from './TimeField';

// Puts one monitor at an existing location — what pressing a pin does on a map opened from
// that monitor's page (see the map view). The one question asked is since when, and it
// starts blank: the event's own start, stored as no start at all, so the placement follows
// the event if its dates move — the same as an empty bound in the assignments table.
export function AssignDeviceDialog({
  device,
  location,
  window,
  onClose,
  onAssigned,
}: {
  device: string;
  // The pin pressed, or null while the dialog is closed.
  location: {id: string; locationName: string} | null;
  // The event's own dates, epoch ms — what the blank start stands for and the field opens on.
  window: {start: number; end: number};
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
}) {
  return (
    <DialogRoot
      open={location != null}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Assign <Name>{device}</Name> to{' '}
            <Name>{location?.locationName ?? ''}</Name>
          </DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Mounted per opening, so the field starts blank every time. */}
        {location && (
          <AssignForm
            device={device}
            locationId={location.id}
            window={window}
            onClose={onClose}
            onAssigned={onAssigned}
          />
        )}
      </DialogContent>
    </DialogRoot>
  );
}

function AssignForm({
  device,
  locationId,
  window,
  onClose,
  onAssigned,
}: {
  device: string;
  locationId: string;
  window: {start: number; end: number};
  onClose: () => void;
  onAssigned: () => Promise<void> | void;
}) {
  const [start, setStart] = useState<number | null>(null);
  const save = useMutation({
    mutationFn: () =>
      assignNoiseDevice({data: {locationId, deviceId: device, start}}),
    onSuccess: () => onAssigned(),
    onError: errorToast('Device could not be assigned'),
  });

  return (
    <>
      <DialogBody>
        <Field.Root>
          <Field.Label>Assigned from</Field.Label>
          <TimeField
            label="Assigned from"
            value={start}
            window={window}
            empty={{label: 'Project start', at: window.start}}
            onChange={setStart}
          />
        </Field.Root>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button loading={save.isPending} onClick={() => save.mutate()}>
          Assign
        </Button>
      </DialogFooter>
    </>
  );
}
