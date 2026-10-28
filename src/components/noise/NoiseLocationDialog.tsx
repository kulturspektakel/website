import {Button, Field, Stack, Text} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Form, Formik} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {
  assignNoiseDevice,
  assignableNoiseDevices,
  createNoiseLocation,
  noiseName,
} from '../../routes/crew.noise';
import {ConnectedField} from '../forms/ConnectedField';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';
// From the map, because the map is what produced the point.
import {type Coordinates} from './LocationsMap';
import {errorToast} from '../toast';
import {noiseQueryKeys} from './queries';
import {TimeField} from './TimeField';

// The point comes from where the map was clicked, so the name is all that has to be
// asked for. The monitor is optional — a location may be placed before anyone has
// carried a box out to it — and its start only means anything once one is picked, so
// neither is required here; the submit handler reads them only when there is a device.
const locationFormSchema = z.object({
  locationName: noiseName,
  deviceId: z.string(),
  // Epoch ms, or null for the event's own start — stored as no start at all, so the
  // placement follows the event if its dates move (see TimeField).
  start: z.number().nullable(),
});

// The value the device select carries for "no monitor yet". Empty string, because
// that is what an unselected native select hands back anyway.
const NO_DEVICE = '';

/**
 * Creates a NoiseLocation — one measurement spot within a project — and, in the same
 * step, puts a monitor there.
 *
 * The two belong together: a location without a device measures nothing, and the
 * moment you have just placed one on the map is the moment you know which box is
 * going there. Doing it here also spares the round trip through the list view that
 * the location card's own assign menu would take.
 *
 * A location is only ever placed by clicking the map, so the clicked point doubles as
 * the open state: non-null means open, and it goes to the server untouched.
 */
export function NoiseLocationDialog({
  coordinates,
  projectId,
  window,
  device,
  onClose,
  onCreated,
}: {
  coordinates: Coordinates | null;
  projectId: string;
  // The event's own dates, epoch ms. A new assignment's start is blank by default — the
  // event's start, which is where a monitor placed now has usually been standing since and
  // where its stored levels begin — and this is what that blank stands for and the field
  // opens on. Editable, for the one that really did arrive halfway through.
  window: {start: number; end: number};
  // The monitor this location is being placed for, when the map was opened from that
  // monitor's page to put it somewhere (see the map view). Preselected. Offered even if it is not among the assignable ones — a placement
  // that overlaps this event counts against it there, and moving it is a decision for whoever
  // opened the map from its page.
  device?: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  // A const, so narrowing it below survives into the submit callback.
  const point = coordinates;
  const open = point != null;

  // Shares its key with the list view's assign menu and the index's unassigned
  // section, so one invalidation after this keeps all three honest. Only fetched
  // while the dialog is open.
  const {data: devices} = useQuery({
    queryKey: noiseQueryKeys.assignableDevicesFor(projectId),
    queryFn: () => assignableNoiseDevices({data: {projectId}}),
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      locationName,
      deviceId,
      start,
    }: {
      locationName: string;
      deviceId: string;
      start: number | null;
    }) => {
      const location = await createNoiseLocation({
        data: {projectId, locationName, ...point!},
      });
      if (deviceId === NO_DEVICE) return;
      // Sequential, and deliberately not rolled into one server fn: the location
      // exists either way, so a rejected assignment (someone else took the monitor
      // in the meantime) surfaces as a failed assignment rather than losing the spot
      // that was just placed on the map.
      await assignNoiseDevice({
        data: {
          locationId: location.id,
          deviceId,
          start,
        },
      });
    },
    onSuccess: () => onCreated(),
    onError: errorToast('Location could not be created'),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New location</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Remounted per open, so no field carries the last one over. */}
        {point && (
          <Formik
            initialValues={{
              locationName: '',
              deviceId: device ?? NO_DEVICE,
              start: null as number | null,
            }}
            validate={toFormikValidate(locationFormSchema)}
            onSubmit={(values) =>
              saveMutation.mutate({
                locationName: values.locationName,
                deviceId: values.deviceId,
                start: values.start,
              })
            }
          >
            {({values, setFieldValue}) => (
              <Form>
                <DialogBody>
                  <Stack gap="4">
                    <ConnectedField
                      name="locationName"
                      label="Name"
                      required
                      placeholder="e.g. Hauptbühne"
                    />
                    <ConnectedField
                      name="deviceId"
                      label="Device"
                      // Only monitors with no open assignment anywhere: one hangs in
                      // one place at a time, so anything else is already somewhere.
                      options={[
                        ...(device && !devices?.some((d) => d.id === device)
                          ? [device]
                          : []),
                        ...(devices ?? []).map((d) => d.id),
                      ].map((id) => ({value: id, label: id}))}
                      helperText={
                        devices?.length === 0 && !device
                          ? 'Every device is assigned.'
                          : undefined
                      }
                    />
                    {/* Only once there is something to date: an empty select leaves
                        this field meaningless, and a form asks for what it uses. */}
                    {values.deviceId !== NO_DEVICE && (
                      <Field.Root>
                        <Field.Label>Assigned from</Field.Label>
                        <TimeField
                          label="Assigned from"
                          value={values.start}
                          window={window}
                          empty={{label: 'Project start', at: window.start}}
                          onChange={(start) =>
                            void setFieldValue('start', start)
                          }
                        />
                      </Field.Root>
                    )}
                  </Stack>
                </DialogBody>
                <DialogFooter>
                  <Text fontSize="xs" color="fg.muted" mr="auto">
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </Text>
                  <Button type="submit" loading={saveMutation.isPending}>
                    Create
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
