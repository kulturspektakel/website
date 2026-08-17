import {useRef, useState} from 'react';
import {
  Button,
  IconButton,
  Input,
  NativeSelectField,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {LuPlus, LuTrash2} from 'react-icons/lu';
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
import {toaster} from '../chakra-snippets/toaster';
import {
  createNoiseLimit,
  deleteNoiseLimit,
  updateNoiseLimit,
  NOISE_LIMIT_DB,
} from '../../routes/crew.noise';
import {errorToast} from './toast';
import {TimeField, useDraftField} from './TimeField';
import {applyEdits, hasEdits} from './draftTable';
import {primarySeries, seriesLabel, seriesOptions} from './level';
import {type SeriesKey} from './series';
import {
  useProjectView,
  type NoiseLimit,
  type NoiseLocationItem,
} from './projectView';

// The rows of the series column, grouped by weighting — the picker's own list, from the one
// place that derives it from the series table (see seriesOptions). Shared and not restated
// so that a series added to the table appears in this menu and in the header's without
// anyone remembering the second one, and so a limit can never be written against a name no
// chart draws.
//
// `false`, because a limit is checked against what the project page plots: stored minutes,
// so the finest window reads `LAeq,1m` here rather than the device page's per-second name for
// the same row.
//
// The timeframe's Leq is not among them, and that falls out of where it lives rather than
// being excluded here: it is not one of the nine series, has no line and no live value, and
// sits outside both blocks in the picker for exactly that reason (see useLevelPick). A limit
// on an average over whatever the timeline happens to be cropped to would be a limit on the
// crop.
const SERIES_GROUPS = seriesOptions(false);

// One line of the table while it is being edited, the same arrangement DraftRow has in
// the assignments dialog: `id` is the row it came from or null for one added here, `key`
// is what React identifies it by, and a null bound means the edge of the event.
//
// `decibels` is null for "nothing typed yet", which is what lets a row exist before it
// says anything — and is the one state Save refuses. `series` has no such state: a new row
// opens on the one the page is showing, because that is overwhelmingly the series someone
// came here to write a limit for.
type DraftLimit = {
  key: string;
  id: string | null;
  series: SeriesKey;
  decibels: number | null;
  start: number | null;
  end: number | null;
};

// How loud one location is allowed to be, as a table you can edit — the sibling of
// LocationAssignmentsDialog, reached from the same ⋮.
//
// What is edited here is drawn on the card's chart below it, as a dashed rule across the
// hours each limit covers (see drawLimits) — and on the monitor's own page while it is
// standing at this place. So this dialog is where the permit is typed, and neither of
// those two is where it is read from.
//
// A table rather than one field on the location because a limit usually has a time on
// it — a festival permitted 100 dB by day and 90 after ten o'clock is two rows, not one
// number with a footnote. Rows are allowed to overlap; which of two applies is for
// whoever reads them, and there is deliberately no warning column.
//
// Nothing is written until Save, for the reason the assignments table isn't either:
// tightening a limit at 22:00 is two edits that are wrong apart from each other — you
// end the day row and start the night one — and a table that saved each field as you
// left it would spend the moment between them recording something nobody meant.
export function LocationLimitsDialog({
  open,
  onClose,
  location,
}: {
  open: boolean;
  onClose: () => void;
  location: NoiseLocationItem;
}) {
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
      // As wide as the assignments dialog: this table is that one's two datetime fields
      // plus two more columns, and at `lg` most of the row was behind a sideways scroll.
      // A preference and not a constraint — the ScrollArea below is what makes any width
      // safe, so this only decides how much of the table you see without dragging it.
      size="xl"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Limits at {location.locationName}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Mounted per opening, which is what discards the draft: Cancel, the ✕ and a
            click outside all just close, and the table is read from the server again
            the next time it is opened. */}
        {open && <LimitsForm location={location} onClose={onClose} />}
      </DialogContent>
    </DialogRoot>
  );
}

function LimitsForm({
  location,
  onClose,
}: {
  location: NoiseLocationItem;
  onClose: () => void;
}) {
  const {project, picked, refresh} = useProjectView();
  // What a new row opens on: the first of the series the page is showing, which is the one
  // whose lines and numbers are in front of whoever pressed Add.
  const primary = primarySeries(picked);

  // Both pinned to the opening: the page behind keeps refetching while this is up (it is
  // a live view), and a draft that re-based itself under the cursor — or a Save that
  // diffed against rows the user never saw — would be a table you cannot trust.
  const [original] = useState(() =>
    [...location.limits].sort((a, b) => a.start - b.start),
  );
  const [rows, setRows] = useState<DraftLimit[]>(() => original.map(toDraft));
  // Only has to outlive the rows on screen, and a row added after one was binned must
  // not reuse the key it had — React would keep the old field's draft string.
  const nextKey = useRef(0);

  const save = useMutation({
    mutationFn: () => saveLimits(original, rows, location.id, project),
    onSuccess: async () => {
      await refresh();
      toaster.create({type: 'success', title: 'Limits saved'});
      onClose();
    },
    onError: errorToast('Limits could not be saved'),
  });

  // A row with no number in it, which would be a limit of nothing — the one thing here
  // the server would reject.
  const incomplete = rows.some((r) => r.decibels == null);
  const dirty = hasEdits(original, rows, (row, was) =>
    isUnchanged(row, was, project),
  );

  return (
    <>
      <DialogBody>
        <Stack gap="3" align="start">
          {/* Scrolls sideways rather than pushing the dialog wider than the screen: a
              datetime-local is as wide as the browser draws it, and two of them beside a
              series name is more than a phone has. */}
          <Table.ScrollArea w="full">
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  {/* Which quantity first, then how much of it: a limit is read as
                      "LAeq,1m up to 95", and the number means nothing without the
                      column to its left. */}
                  <Table.ColumnHeader>Series</Table.ColumnHeader>
                  <Table.ColumnHeader>Limit (dB)</Table.ColumnHeader>
                  <Table.ColumnHeader>Start</Table.ColumnHeader>
                  <Table.ColumnHeader>End</Table.ColumnHeader>
                  {/* The bin: one icon wide, and it doesn't need saying at the top. */}
                  <Table.ColumnHeader w="0" />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <LimitRow
                    key={row.key}
                    row={row}
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
          </Table.ScrollArea>
          {rows.length === 0 && (
            <Text fontSize="sm" color="fg.muted">
              No limit set for this location.
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
                  series: primary,
                  decibels: null,
                  start: null,
                  end: null,
                },
              ])
            }
          >
            <LuPlus /> Add limit
          </Button>
        </Stack>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
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

// One limit, as a row of fields over the draft. It writes nothing — every edit goes up
// to the dialog, which is the only thing that knows what the whole table says.
function LimitRow({
  row,
  window,
  onChange,
  onRemove,
}: {
  row: DraftLimit;
  window: {start: number; end: number};
  onChange: (row: DraftLimit) => void;
  onRemove: () => void;
}) {
  // What the row's controls are called for anyone not reading the table. Both halves of
  // what a limit is, since either alone names two rows the same the moment a location has a
  // limit on two series — or what the row is for while it has no figure yet.
  const which =
    row.decibels == null
      ? `new ${seriesLabel(row.series, false)} limit`
      : `${row.decibels} dB ${seriesLabel(row.series, false)} limit`;

  return (
    <Table.Row>
      <Table.Cell>
        {/* Editable on a saved row, unlike the device on a placement — and that is not an
            inconsistency. A placement's device is *what the row is about*, so changing it
            would be quietly substituting one monitor's history for another's; a limit's
            series is a property of the figure, and a permit read as an LAeq that turns out
            to be written against LCpeak is this row with the wrong quantity on it. */}
        <NativeSelectRoot size="sm" w="32">
          <NativeSelectField
            aria-label={`Series of ${which}`}
            value={row.series}
            onChange={(e) =>
              // The options are the table's own keys, so the cast is the DOM's string
              // coming back as what was put into it.
              onChange({...row, series: e.currentTarget.value as SeriesKey})
            }
          >
            {/* A group per weighting, headed by the unit its rows read in — the same
                arrangement and the same reason as the header's menu: `LAeq,5m` and
                `LCeq,5m` differ by one letter mid-name, and nine of those in a flat list
                is nothing anyone can scan. */}
            {SERIES_GROUPS.map(({weighting, unit, options}) => (
              <optgroup key={weighting} label={unit}>
                {options.map(({key, label}) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelectField>
        </NativeSelectRoot>
      </Table.Cell>
      <Table.Cell>
        <DecibelField
          label={`Limit in decibels of ${which}`}
          value={row.decibels}
          onChange={(decibels) => onChange({...row, decibels})}
        />
      </Table.Cell>
      <Table.Cell>
        <TimeField
          label={`Start of ${which}`}
          value={row.start}
          window={window}
          onChange={(start) => onChange({...row, start})}
        />
      </Table.Cell>
      <Table.Cell>
        <TimeField
          label={`End of ${which}`}
          value={row.end}
          window={window}
          onChange={(end) => onChange({...row, end})}
        />
      </Table.Cell>
      <Table.Cell>
        <IconButton
          aria-label={`Delete ${which}`}
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

// The number itself, over the same draft string every field in these two tables keeps
// (see useDraftField).
//
// An empty field reports null, never 0: Number('') is 0, and a limit of absolute silence
// is the one wrong value that would look like a deliberate one. Reported on change
// rather than on blur, unlike TimeField's clear, because here there is nothing ambiguous
// about it — a blank dB field means the row isn't finished, which is exactly what Save
// refuses to write.
function DecibelField({
  label,
  value,
  onChange,
}: {
  // Not rendered: the column heading says what this is, and the row says which series and
  // when, but neither is attached to the input for anyone not reading the table.
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const {draft, setDraft, revert} = useDraftField(value, String);

  return (
    <Input
      type="number"
      aria-label={label}
      size="sm"
      w="24"
      // Native attributes only — what is actually enforced is the schema these come from,
      // and a field that refused to hold a mistyped number would also refuse to let you
      // correct it.
      min={NOISE_LIMIT_DB.min}
      max={NOISE_LIMIT_DB.max}
      // Permits are written to a tenth as often as to the decibel.
      step="0.1"
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseDecibels(e.target.value));
      }}
      onBlur={() => {
        // Never leave a value on screen that isn't the one in effect: a draft that
        // never parsed is abandoned rather than guessed at.
        if (parseDecibels(draft) == null) revert();
      }}
    />
  );
}

// Null for anything that isn't a dB figure the server would take — blank, half-typed,
// out of range. The range is checked here and not only on the wire so that a typo
// leaves Save disabled rather than producing a rejection with nothing attached to it.
function parseDecibels(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < NOISE_LIMIT_DB.min || n > NOISE_LIMIT_DB.max) {
    return null;
  }
  return n;
}

// A blank bound comes back blank, which is what makes the fields round-trip: blank one,
// save, and it is still blank rather than filled in with a time you didn't type — and
// the limit still follows the event's dates rather than being pinned to what they were.
//
// The loader says which each is (`startsWithProject`/`endsWithProject`) rather than this
// comparing the resolved instant against the project's, which could not tell a limit
// deliberately pinned to the event's exact edge from one that has no bound at all.
function toDraft(limit: NoiseLimit): DraftLimit {
  return {
    key: limit.id,
    id: limit.id,
    series: limit.series,
    decibels: limit.decibels,
    start: limit.startsWithProject ? null : limit.start,
    end: limit.endsWithProject ? null : limit.end,
  };
}

// Whether a row still says what the server has, with the draft's blanks resolved the way
// the loader resolved the saved row's — both ends, since both of a limit's are the event's
// own (see limitLine).
const isUnchanged = (
  row: DraftLimit,
  was: NoiseLimit,
  project: {start: number; end: number},
): boolean =>
  row.series === was.series &&
  row.decibels === was.decibels &&
  (row.start ?? project.start) === was.start &&
  (row.end ?? project.end) === was.end;

// One press, over the protocol both dialogs share (see applyEdits). All this supplies is
// the three mutations and what counts as a change.
const saveLimits = (
  original: NoiseLimit[],
  rows: DraftLimit[],
  locationId: string,
  project: {start: number; end: number},
): Promise<void> =>
  applyEdits(original, rows, {
    isUnchanged: (row, was) => isUnchanged(row, was, project),
    // A row short of a number is not written. Can't happen — Save is disabled while any
    // row is — but the types say it can, and a 0 dB limit is not the thing to fall back on.
    create: (row) =>
      row.decibels == null
        ? undefined
        : createNoiseLimit({
            data: {
              locationId,
              series: row.series,
              decibels: row.decibels,
              start: row.start,
              end: row.end,
            },
          }),
    update: (row, limitId) =>
      row.decibels == null
        ? undefined
        : updateNoiseLimit({
            data: {
              limitId,
              series: row.series,
              decibels: row.decibels,
              start: row.start,
              end: row.end,
            },
          }),
    remove: (was) => deleteNoiseLimit({data: {limitId: was.id}}),
  });
