import {Button} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {Form, Formik} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {createNoiseLocation, noiseName} from '../../routes/crew.lautstaerke';
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

// The name is the only thing left to ask for: the point comes from where the map
// was clicked, and the pin plus the coordinates on the location card already show
// it back. So there's nothing here to validate but the name.
const locationFormSchema = z.object({locationName: noiseName});

/**
 * Creates a NoiseLocation — one measurement spot within a project. A location is
 * only ever placed by clicking the map, so the clicked point doubles as the open
 * state: non-null means open, and it goes to the server untouched.
 */
export function NoiseLocationDialog({
  coordinates,
  projectId,
  onClose,
  onCreated,
}: {
  coordinates: Coordinates | null;
  projectId: string;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  // A const, so narrowing it below survives into the submit callback.
  const point = coordinates;

  const saveMutation = useMutation({
    mutationFn: async (data: Coordinates & {locationName: string}) =>
      createNoiseLocation({data: {projectId, ...data}}),
    onSuccess: () => onCreated(),
    onError: errorToast('Standort konnte nicht erstellt werden'),
  });

  return (
    <DialogRoot
      open={point != null}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Standort</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Remounted per open, so the name field never carries the last one over. */}
        {point && (
          <Formik
            initialValues={{locationName: ''}}
            validate={toFormikValidate(locationFormSchema)}
            onSubmit={(values) => saveMutation.mutate({...values, ...point})}
          >
            <Form>
              <DialogBody>
                <ConnectedField
                  name="locationName"
                  label="Name"
                  required
                  placeholder="z. B. Hauptbühne"
                />
              </DialogBody>
              <DialogFooter>
                <Button type="submit" loading={saveMutation.isPending}>
                  Erstellen
                </Button>
              </DialogFooter>
            </Form>
          </Formik>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
