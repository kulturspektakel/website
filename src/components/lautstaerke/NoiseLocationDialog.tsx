import {Button, Stack, Text} from '@chakra-ui/react';
import {useMutation, useQuery} from '@tanstack/react-query';
import {Form, Formik} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {
  assignNoiseDevice,
  assignableNoiseDevices,
  createNoiseLocation,
  noiseName,
} from '../../routes/crew.lautstaerke';
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
import {errorToast} from './toast';
import {noiseQueryKeys} from './queries';
import {fromLocalInput, toLocalInput} from './timeframe';
import {timeZone} from '../../utils/dateUtils';

// The point comes from where the map was clicked, so the name is all that has to be
// asked for. The monitor is optional — a location may be placed before anyone has
// carried a box out to it — and its start only means anything once one is picked, so
// neither is required here; the submit handler reads them only when there is a device.
const locationFormSchema = z
  .object({
    locationName: noiseName,
    deviceId: z.string(),
    start: z.string(),
  })
  // A cleared date field would otherwise assign silently from now, which is the one
  // outcome someone editing that field is trying to avoid.
  .superRefine((values, ctx) => {
    if (values.deviceId !== NO_DEVICE && fromLocalInput(values.start) == null) {
      ctx.addIssue({
        code: 'custom',
        path: ['start'],
        message: 'Bitte einen Zeitpunkt angeben.',
      });
    }
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
  projectStart,
  onClose,
  onCreated,
}: {
  coordinates: Coordinates | null;
  projectId: string;
  // The project's start, epoch ms — what a new assignment is dated from. A monitor
  // placed now has usually been standing there since the event began, and its stored
  // levels start where the project does, so this is the span one wants its history
  // to cover. Editable, for the one that really did arrive halfway through.
  projectStart: number;
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
    queryKey: noiseQueryKeys.assignableDevices,
    queryFn: () => assignableNoiseDevices(),
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
      start: Date | null;
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
          start: start?.getTime(),
        },
      });
    },
    onSuccess: () => onCreated(),
    onError: errorToast('Standort konnte nicht erstellt werden'),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      {/* Light, though the area around it is dark — see DARK_ROUTE_ID in __root. */}
      <DialogContent appearance="light">
        <DialogHeader>
          <DialogTitle>Neuer Standort</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Remounted per open, so no field carries the last one over. */}
        {point && (
          <Formik
            initialValues={{
              locationName: '',
              deviceId: NO_DEVICE,
              start: toLocalInput(projectStart),
            }}
            validate={toFormikValidate(locationFormSchema)}
            onSubmit={(values) =>
              saveMutation.mutate({
                locationName: values.locationName,
                deviceId: values.deviceId,
                start: fromLocalInput(values.start),
              })
            }
          >
            {({values}) => (
              <Form>
                <DialogBody>
                  <Stack gap="4">
                    <ConnectedField
                      name="locationName"
                      label="Name"
                      required
                      placeholder="z. B. Hauptbühne"
                    />
                    <ConnectedField
                      name="deviceId"
                      label="Gerät"
                      // Only monitors with no open assignment anywhere: one hangs in
                      // one place at a time, so anything else is already somewhere.
                      options={(devices ?? []).map((d) => ({
                        value: d.id,
                        label: d.id,
                      }))}
                      helperText={
                        devices?.length === 0
                          ? 'Alle Geräte sind zugewiesen.'
                          : undefined
                      }
                    />
                    {/* Only once there is something to date: an empty select leaves
                        this field meaningless, and a form asks for what it uses. */}
                    {values.deviceId !== NO_DEVICE && (
                      <ConnectedField
                        name="start"
                        label="Zugewiesen ab"
                        type="datetime-local"
                        helperText={`Zeit in ${timeZone}. Standard ist der Beginn des Projekts.`}
                      />
                    )}
                  </Stack>
                </DialogBody>
                <DialogFooter>
                  <Text fontSize="xs" color="gray.500" mr="auto">
                    {point.latitude.toFixed(5)}, {point.longitude.toFixed(5)}
                  </Text>
                  <Button type="submit" loading={saveMutation.isPending}>
                    Erstellen
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
