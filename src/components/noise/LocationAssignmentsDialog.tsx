import {useRef, useState} from 'react';
import {
  Button,
  IconButton,
  NativeSelectField,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {LuPlus, LuTrash2, LuTriangleAlert} from 'react-icons/lu';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
import {NativeSelectRoot} from '../chakra-snippets/native-select';
import {Tooltip} from '../chakra-snippets/tooltip';
import {toaster} from '../chakra-snippets/toaster';
import {
  assignNoiseDevice,
  deleteNoiseAssignment,
  noiseMonitorDevices,
  updateNoiseAssignment,
} from '../../routes/crew.noise';
import {noiseQueryKeys} from './queries';
import {errorToast} from './toast';
import {TimeField} from './TimeField';
import {applyEdits, hasEdits} from './draftTable';
import {formatInstant, formatTimeframeRange} from './timeframe';
import {
  overlappingAssignments,
  useProjectView,
  type AssignmentConflict,
  type AssignmentWindow,
  type NoiseAssignment,
  type NoiseLocationItem,
} from './projectView';

const NO_DEVICE = '';

// One line of the table while it is being edited. `id` is the row it came from, or null
// for one added here; `key` is what React and the overlap check identify it by, and a new
// row needs one of those before it has an id.
//
// `start` null means the same thing here as in the column behind it: the edge of the event,
// whenever that turns out to be.
type DraftRow = {
  key: string;
  id: string | null;
  deviceId: string;
  start: number | null;
  end: number | null;
};

// Everything that has ever stood at one location, as a table you can edit — which is
// what replaced the two menus this section used to assign with.
//
// Those could say only two things, both about now: put a monitor here as of this second,
// and take that one away as of this second. Neither could express the placement that
// ran from Friday evening to Saturday morning, correct a handover recorded an hour late,
// or take back a monitor that was never actually carried out there — an assignment could
// only ever be *closed*, so a placement that never happened stayed in the history as an
// empty window that assignmentsAt and every log query still had to read past.
//
// A table rather than a stack of labelled fields because every row says the same three
// things about a different monitor, and the question being asked of it — did anything
// here run over anything else — is read down the columns, not across one row.
//
// Nothing is written until Save. Correcting a handover is two edits that are wrong
// apart from each other — you move one row's end and the next row's start — and a table
// that saved each field as you left it would spend the moment between them recording an
// overlap, invalidating the page, and reordering the rows under the cursor.
export function LocationAssignmentsDialog({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  // The location's *whole* history, not the monitors resolved at the playhead: this is
  // where the history is edited, so scrubbing must not hide a row from it.
  location: NoiseLocationItem;
}) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
      size="xl"
    >
      {/* Light, though the area around it is dark — see DARK_ROUTE_ID in __root. */}
      <DialogContent appearance="light">
        <DialogHeader>
          <DialogTitle>Devices at {location.locationName}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Mounted per opening, which is what discards the draft: Cancel, the ✕ and
            a click outside all just close, and the table is read from the server again
            the next time it is opened. */}
        {open && <AssignmentsForm location={location} onClose={onClose} />}
      </DialogContent>
    </DialogRoot>
  );
}

function AssignmentsForm({
  location,
  onClose,
}: {
  location: NoiseLocationItem;
  onClose: () => void;
}) {
  const {project, refresh} = useProjectView();

  // Every monitor there is, not only the free ones: recording a placement that has
  // already ended is half of what this is for, and the monitor whose past you are
  // fixing is usually the one standing somewhere else today. Fetched per opening —
  // every card on the page mounts one of these, and most are never opened.
  const {data: devices} = useQuery({
    queryKey: noiseQueryKeys.monitorDevices,
    queryFn: () => noiseMonitorDevices(),
  });

  // Both pinned to the opening: the page behind keeps refetching while this is up (it
  // is a live view), and a draft that re-based itself under the cursor — or a Save
  // that diffed against rows the user never saw — would be a table you cannot trust.
  const [original] = useState(() =>
    [...location.assignments].sort((a, b) => a.start - b.start),
  );
  const [rows, setRows] = useState<DraftRow[]>(() => original.map(toDraft));
  // Only has to outlive the rows on screen, and a row added after one was binned must
  // not reuse the key it had — React would keep the old field's draft string.
  const nextKey = useRef(0);

  const save = useMutation({
    mutationFn: () => saveAssignments(original, rows, location.id, project.start),
    onSuccess: async () => {
      await refresh();
      toaster.create({type: 'success', title: 'Assignments saved'});
      onClose();
    },
    onError: errorToast('Assignments could not be saved'),
  });

  // This location's rows as they would be if saved, so the warnings are about what
  // Save would leave behind rather than about what is on the server. Rows with no
  // device yet are nothing to compare — there is no monitor to be in two places.
  const pending = project.locations.map((l) =>
    l.id === location.id
      ? {
          ...l,
          assignments: rows
            .filter(hasDevice)
            .map((r) => toWindow(r, project.start)),
        }
      : l,
  );

  const incomplete = rows.some((r) => r.deviceId === NO_DEVICE);
  const dirty = hasEdits(original, rows, (row, was) =>
    isUnchanged(row, was, project.start),
  );

  return (
    <>
      <DialogBody>
        <Stack gap="3" align="start">
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Device</Table.ColumnHeader>
                <Table.ColumnHeader>Start</Table.ColumnHeader>
                <Table.ColumnHeader>End</Table.ColumnHeader>
                {/* The warning and the bin: both one icon wide, and neither needs
                      saying twice at the top of the table. */}
                <Table.ColumnHeader w="0" />
                <Table.ColumnHeader w="0" />
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {rows.map((row) => (
                <AssignmentRow
                  key={row.key}
                  row={row}
                  devices={devices}
                  conflicts={
                    hasDevice(row)
                      ? overlappingAssignments(
                          toWindow(row, project.start),
                          location.id,
                          pending,
                        )
                      : []
                  }
                  window={project}
                  onChange={(next) =>
                    setRows((rs) =>
                      rs.map((r) => (r.key === row.key ? next : r)),
                    )
                  }
                  onRemove={() =>
                    setRows((rs) => rs.filter((r) => r.key !== row.key))
                  }
                />
              ))}
            </Table.Body>
          </Table.Root>
          {rows.length === 0 && (
            <Text fontSize="sm" color="fg.muted">
              No device has stood here yet.
            </Text>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                {
                  key: `new-${nextKey.current++}`,
                  id: null,
                  deviceId: NO_DEVICE,
                  start: null,
                  end: null,
                },
              ])
            }
          >
            <LuPlus /> Add device
          </Button>
        </Stack>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          // Nothing to save, or a row with no monitor in it — which would be a
          // placement of nothing, and is the one thing here the server would reject.
          disabled={!dirty || incomplete}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

// One placement, as a row of fields over the draft. It writes nothing — every edit goes
// up to the dialog, which is the only thing that knows what the whole table says.
function AssignmentRow({
  row,
  devices,
  conflicts,
  window,
  onChange,
  onRemove,
}: {
  row: DraftRow;
  devices: Array<{id: string}> | undefined;
  conflicts: AssignmentConflict[];
  window: {start: number; end: number};
  onChange: (row: DraftRow) => void;
  onRemove: () => void;
}) {
  // What the row's controls are called for anyone not reading the table: the monitor,
  // or what the row is for while it has none yet.
  const who = row.deviceId || 'new assignment';

  return (
    <Table.Row>
      <Table.Cell fontWeight="medium">
        {/* Which monitor a saved row is about is not editable: that is a different
            placement, so it is a bin and a new row rather than a quiet substitution
            of one device's history for another's. */}
        {row.id != null ? (
          row.deviceId
        ) : (
          <NativeSelectRoot size="sm">
            <NativeSelectField
              aria-label="Device"
              value={row.deviceId}
              onChange={(e) =>
                onChange({...row, deviceId: e.currentTarget.value})
              }
            >
              <option value={NO_DEVICE}>Choose device…</option>
              {(devices ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.id}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        )}
      </Table.Cell>
      <Table.Cell>
        <TimeField
          label={`Start of ${who}`}
          value={row.start}
          window={window}
          onChange={(start) => onChange({...row, start})}
        />
      </Table.Cell>
      <Table.Cell>
        <TimeField
          label={`End of ${who}`}
          value={row.end}
          window={window}
          onChange={(end) => onChange({...row, end})}
        />
      </Table.Cell>
      <Table.Cell>
        <ConflictWarning row={row} conflicts={conflicts} />
      </Table.Cell>
      <Table.Cell>
        <IconButton
          aria-label={`Delete assignment of ${who}`}
          size="sm"
          variant="ghost"
          color="fg.error"
          _hover={{bg: 'bg.error'}}
          onClick={onRemove}
        >
          <LuTrash2 />
        </IconButton>
      </Table.Cell>
    </Table.Row>
  );
}

// A warning, not a block — the record is allowed to say something odd while you are
// halfway through correcting it, and only you know which of the two rows is wrong.
//
// A triangle rather than a line of red under the row: in a table the text would push
// the columns apart and be read as belonging to the one below it. What it says is in the
// tooltip, and in the button's own label so that it is not the hover alone that carries
// it. A button and not a bare icon because a tooltip nobody can focus is a tooltip
// nobody on a phone or a keyboard ever sees.
function ConflictWarning({
  row,
  conflicts,
}: {
  row: {deviceId: string};
  conflicts: AssignmentConflict[];
}) {
  if (conflicts.length === 0) return null;
  const text = conflicts.map((c) => conflictMessage(row, c)).join(' ');

  return (
    <Tooltip content={text} showArrow>
      <IconButton
        aria-label={text}
        size="sm"
        variant="ghost"
        color="fg.warning"
        _hover={{bg: 'bg.warning'}}
      >
        <LuTriangleAlert />
      </IconButton>
    </Tooltip>
  );
}

function conflictMessage(
  row: {deviceId: string},
  {locationName, assignment}: AssignmentConflict,
): string {
  const when =
    assignment.end == null
      ? `from ${formatInstant(assignment.start)}`
      : formatTimeframeRange(assignment.start, assignment.end);
  return assignment.deviceId === row.deviceId
    ? `${assignment.deviceId} stands at “${locationName}” at the same time (${when}).`
    : `Overlaps with ${assignment.deviceId} (${when}).`;
}

const hasDevice = (row: DraftRow) => row.deviceId !== NO_DEVICE;

// A blank start comes back blank, which is what makes the field round-trip: blank it, save,
// and it is still blank rather than filled in with a time you didn't type — and the
// placement still follows the event's dates rather than being pinned to what they were.
//
// The loader says which it is (`startsWithProject`) rather than this comparing the resolved
// instant against the project's, which is what it used to do when the column could not hold
// a blank: a placement deliberately pinned to the event's exact start was indistinguishable
// from one that had none, and saving either wrote a fixed time.
function toDraft(assignment: NoiseAssignment): DraftRow {
  return {
    key: assignment.id,
    id: assignment.id,
    deviceId: assignment.deviceId,
    start: assignment.startsWithProject ? null : assignment.start,
    end: assignment.end,
  };
}

// A row as the overlap check reads it, with the blank bounds resolved the way the server
// will resolve them — so a warning is about the placement rather than about the field.
const toWindow = (row: DraftRow, projectStart: number): AssignmentWindow => ({
  id: row.key,
  deviceId: row.deviceId,
  start: row.start ?? projectStart,
  end: row.end,
});

// Whether a row still says what the server has, with the draft's blank start resolved the
// way the loader resolved the saved row's. The end is compared raw: an open placement is
// genuinely open — "still standing" is not an instant — so null there is the value rather
// than a stand-in for one.
const isUnchanged = (
  row: DraftRow,
  was: NoiseAssignment,
  projectStart: number,
): boolean =>
  (row.start ?? projectStart) === was.start && (row.end ?? null) === was.end;

// One press, over the protocol both dialogs share (see applyEdits). All this supplies is
// the three mutations and what counts as a change. The device is not among the updatable
// fields on purpose: which monitor a saved row is about is not editable, since that would
// be a different placement (see the picker above).
const saveAssignments = (
  original: NoiseAssignment[],
  rows: DraftRow[],
  locationId: string,
  projectStart: number,
): Promise<void> =>
  applyEdits(original, rows, {
    isUnchanged: (row, was) => isUnchanged(row, was, projectStart),
    create: (row) =>
      assignNoiseDevice({
        data: {
          locationId,
          deviceId: row.deviceId,
          start: row.start,
          end: row.end,
        },
      }),
    update: (row, assignmentId) =>
      updateNoiseAssignment({
        data: {assignmentId, start: row.start, end: row.end},
      }),
    remove: (was) => deleteNoiseAssignment({data: {assignmentId: was.id}}),
  });
