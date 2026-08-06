import {Button, Stack, Text} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {Form, Formik} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {createNoiseProject, noiseName} from '../../routes/crew.lautstaerke';
import {ConnectedField} from '../forms/ConnectedField';
import {timeZone} from '../../utils/dateUtils';
import {END_BEFORE_START, fromLocalInput} from './timeframe';
import {errorToast} from './toast';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';

// The two datetime fields are wall-clock in `timeZone`; fromLocalInput turns them
// into instants DST-correctly, so the form validates the strings and converts
// only once, on submit. MAX_RANGE_DAYS deliberately doesn't apply here — that cap
// protects the minute-aggregate history query, not a festival's length.
const projectFormSchema = z
  .object({
    name: noiseName,
    start: z
      .string()
      .refine((v) => fromLocalInput(v) != null, 'Beginn erforderlich'),
    end: z.string().refine((v) => fromLocalInput(v) != null, 'Ende erforderlich'),
  })
  .refine(
    (v) => {
      const start = fromLocalInput(v.start);
      const end = fromLocalInput(v.end);
      // Field-level errors already cover the unparseable case.
      return !start || !end || end.getTime() > start.getTime();
    },
    {message: END_BEFORE_START, path: ['end']},
  );

/** Creates a NoiseProject — a festival's measurement window. */
export function NoiseProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: string) => Promise<void> | void;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: {name: string; start: string; end: string}) =>
      createNoiseProject({
        data: {
          name: values.name,
          start: fromLocalInput(values.start)!.toISOString(),
          end: fromLocalInput(values.end)!.toISOString(),
        },
      }),
    onSuccess: (created) => onCreated(created.id),
    onError: errorToast('Projekt konnte nicht erstellt werden'),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neues Projekt</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {/* Remounted per open, so initialValues are always fresh. */}
        {open && (
          <Formik
            initialValues={{name: '', start: '', end: ''}}
            validate={toFormikValidate(projectFormSchema)}
            onSubmit={(values) => saveMutation.mutate(values)}
          >
            <Form>
              <DialogBody>
                <Stack gap="4">
                  <ConnectedField name="name" label="Name" required />
                  <ConnectedField
                    name="start"
                    label="Beginn"
                    required
                    type="datetime-local"
                  />
                  <ConnectedField
                    name="end"
                    label="Ende"
                    required
                    type="datetime-local"
                  />
                  <Text fontSize="sm" color="gray.500">
                    Zeiten in {timeZone}.
                  </Text>
                </Stack>
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
