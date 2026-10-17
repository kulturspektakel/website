import {useState} from 'react';
import {
  Button,
  Field,
  NativeSelectField,
  Stack,
  Input,
  Text,
} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
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
import {Radio, RadioGroup} from '../chakra-snippets/radio';
import {toaster} from '../chakra-snippets/toaster';
import {createNoiseTag, type NoiseTagScope} from '../../routes/crew.noise';
import {errorToast} from './toast';
import {TimeField} from './TimeField';
import {END_BEFORE_START} from './timeframe';
import {
  useProjectView,
  type DeviceWindows,
  type NoiseLocationItem,
} from './projectView';
import {Name} from './Name';

type ScopeKind = NoiseTagScope['kind'];

// Tags a swept range — what the selection menu's "Comment…" and "Ignore…" open. One dialog for
// both, since a tag is the same record either way and the decisions are the same two: which
// stretch, and what it applies to. A comment adds the one thing it is for, what it says.
//
// The range arrives from the sweep, but the sweep is a gesture at chart resolution and a
// tag is a record, so both ends are editable here before anything is written. Either end may
// be left at the event's own — "Project start", "Project end" — which is saved as that instant:
// an ignored stretch has to have two ends to set anything aside, and a comment made from a
// sweep is about the stretch swept.
//
// What it applies to is the one real decision: the monitor (its readings wherever it
// stood during the range), the place (every monitor that stood here), or the whole
// event. The place is the default, because that is the chart the range was drawn on.
//
// Mounted per range, so Cancel, the ✕ and a click outside all discard the draft by
// unmounting it.
export function RangeTagDialog({
  type,
  range,
  location,
  lines,
  onClose,
}: {
  type: 'IGNORE' | 'COMMENT';
  range: {start: number; end: number};
  location: NoiseLocationItem;
  // The monitors this location has had, which are the ones a device tag can name from here.
  lines: readonly DeviceWindows[];
  onClose: () => void;
}) {
  const {project, refresh} = useProjectView();
  // Rounded to the minute: the sweep arrives as fractional ms (pixels through the scale),
  // which the server's integer bounds reject — and the fields only show minutes, so
  // anything finer would be saved without ever having been on screen.
  const [start, setStart] = useState<number | null>(() =>
    toMinute(range.start),
  );
  const [end, setEnd] = useState<number | null>(() => toMinute(range.end));
  const [kind, setKind] = useState<ScopeKind>('location');
  // What a comment says. A comment is its text, so it cannot be saved without one.
  const [text, setText] = useState('');
  const comment = type === 'COMMENT';
  const [deviceId, setDeviceId] = useState(
    () => busiestDevice(lines, range) ?? '',
  );

  const scope: NoiseTagScope =
    kind === 'device'
      ? {kind, deviceId}
      : kind === 'location'
        ? {kind, locationId: location.id}
        : {kind};

  const save = useMutation({
    mutationFn: () =>
      createNoiseTag({
        data: {
          projectId: project.id,
          type,
          scope,
          start: start ?? project.start,
          end: end ?? project.end,
          text: comment ? text.trim() : undefined,
        },
      }),
    onSuccess: async () => {
      await refresh();
      toaster.create({
        type: 'success',
        title: comment ? 'Comment added' : 'Range ignored',
      });
      onClose();
    },
    onError: errorToast(
      comment ? 'Comment could not be saved' : 'Range could not be saved',
    ),
  });

  const backwards = (end ?? project.end) <= (start ?? project.start);

  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      {/* Just wide enough for the start and end fields side by side (see the body): two
          TimeFields at their least and the gap between them, plus the dialog's own padding —
          between Chakra's `lg`, which is a little short, and `xl`, which is roomier than a
          form this size wants. */}
      <DialogContent maxW="34rem">
        <DialogHeader>
          <DialogTitle>{comment ? 'Add comment' : 'Ignore range'}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap="4">
            {comment && (
              <Field.Root required>
                <Field.Label>Comment</Field.Label>
                {/* One line, as the label on the chart is. */}
                <Input
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.currentTarget.value)}
                  maxLength={2000}
                />
              </Field.Root>
            )}
            {/* Side by side, the way a range is read — and so the dialog is the wider size
                (see below): a TimeField holds its width so the browser's picker shows the
                whole date and time. Stacked on a phone, which has no room for both. */}
            <Stack direction={{base: 'column', sm: 'row'}} gap="3">
              <Field.Root>
                <Field.Label>Start</Field.Label>
                <TimeField
                  label="Start"
                  value={start}
                  window={project}
                  empty={{label: 'Project start', at: project.start}}
                  onChange={setStart}
                />
              </Field.Root>
              <Field.Root invalid={backwards}>
                <Field.Label>End</Field.Label>
                <TimeField
                  label="End"
                  value={end}
                  window={project}
                  empty={{label: 'Project end', at: project.end}}
                  onChange={setEnd}
                />
                {backwards && (
                  <Field.ErrorText>{END_BEFORE_START}</Field.ErrorText>
                )}
              </Field.Root>
            </Stack>
            <Stack gap="2">
              <Text fontSize="sm" fontWeight="medium">
                Applies to
              </Text>
              <RadioGroup
                value={kind}
                onValueChange={(e) => setKind(e.value as ScopeKind)}
                size="sm"
              >
                <Stack gap="2">
                  <Radio value="device" disabled={lines.length === 0}>
                    {lines.length === 1 ? (
                      <>
                        Device <Name>{lines[0]!.deviceId}</Name>
                      </>
                    ) : (
                      'One device'
                    )}
                  </Radio>
                  {/* Only when there is a choice to make: a location that has had one
                      monitor names it in the label above. */}
                  {kind === 'device' && lines.length > 1 && (
                    <NativeSelectRoot size="sm" w="48" ms="6">
                      <NativeSelectField
                        aria-label="Device"
                        value={deviceId}
                        onChange={(e) => setDeviceId(e.currentTarget.value)}
                      >
                        {lines.map((l) => (
                          <option key={l.deviceId} value={l.deviceId}>
                            {l.deviceId}
                          </option>
                        ))}
                      </NativeSelectField>
                    </NativeSelectRoot>
                  )}
                  <Radio value="location">
                    All devices at <Name>{location.locationName}</Name>
                  </Radio>
                  <Radio value="event">
                    Everything in <Name>{project.name}</Name>
                  </Radio>
                </Stack>
              </RadioGroup>
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            disabled={backwards || (comment && text.trim() === '')}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}

const toMinute = (ms: number) => Math.round(ms / 60_000) * 60_000;

// The monitor that stood here for most of the range: the one a device tag drawn on this
// chart is most likely about. Null for a location nothing has stood at.
function busiestDevice(
  lines: readonly DeviceWindows[],
  range: {start: number; end: number},
): string | null {
  let best: {deviceId: string; overlap: number} | null = null;
  for (const {deviceId, windows} of lines) {
    const overlap = windows.reduce(
      (sum, w) =>
        sum +
        Math.max(
          0,
          Math.min(w.end ?? Infinity, range.end) -
            Math.max(w.start, range.start),
        ),
      0,
    );
    if (!best || overlap > best.overlap) best = {deviceId, overlap};
  }
  return best?.deviceId ?? null;
}
