import {useState} from 'react';
import {Button, Field, NativeSelectField, Stack, Text} from '@chakra-ui/react';
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

type ScopeKind = NoiseTagScope['kind'];

// Tags a swept range as one to leave out — what the selection menu's "Ignore…" opens.
//
// The range arrives from the sweep, but the sweep is a gesture at chart resolution and a
// tag is a record, so both ends are editable here before anything is written. A blank end
// makes it a marker: an instant rather than a stretch.
//
// What it applies to is the one real decision: the monitor (its readings wherever it
// stood during the range), the place (every monitor that stood here), or the whole
// event. The place is the default, because that is the chart the range was drawn on.
//
// Mounted per range, so Cancel, the ✕ and a click outside all discard the draft by
// unmounting it.
export function RangeTagDialog({
  range,
  location,
  lines,
  onClose,
}: {
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
    mutationFn: (from: number) =>
      createNoiseTag({
        data: {projectId: project.id, type: 'IGNORE', scope, start: from, end},
      }),
    onSuccess: async () => {
      await refresh();
      toaster.create({type: 'success', title: 'Range ignored'});
      onClose();
    },
    onError: errorToast('Range could not be saved'),
  });

  const backwards = start != null && end != null && end <= start;

  return (
    <DialogRoot
      open
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ignore range</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          <Stack gap="4">
            <Stack direction={{base: 'column', sm: 'row'}} gap="3">
              <Field.Root required>
                <Field.Label>Start</Field.Label>
                <TimeField
                  label="Start"
                  value={start}
                  window={project}
                  onChange={setStart}
                />
              </Field.Root>
              <Field.Root invalid={backwards}>
                <Field.Label>End</Field.Label>
                <TimeField
                  label="End"
                  value={end}
                  window={project}
                  onChange={setEnd}
                />
                {backwards ? (
                  <Field.ErrorText>{END_BEFORE_START}</Field.ErrorText>
                ) : (
                  end == null && (
                    <Field.HelperText>
                      No end: a marker at the start.
                    </Field.HelperText>
                  )
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
                    {lines.length === 1
                      ? `Device ${lines[0]!.deviceId}`
                      : 'One device'}
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
                    All devices at {location.locationName}
                  </Radio>
                  <Radio value="event">Everything in {project.name}</Radio>
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
            disabled={start == null || backwards}
            loading={save.isPending}
            onClick={() => start != null && save.mutate(start)}
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
