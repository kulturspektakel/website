import {Box, Button, HStack, Input, Stack} from '@chakra-ui/react';
import {useMutation} from '@tanstack/react-query';
import {Field as FormikField, Form, Formik, useField} from 'formik';
import {toFormikValidate} from 'zod-formik-adapter';
import {z} from 'zod';
import {createProductList, updateProductList} from '../../routes/crew.produkte';
import {ConnectedField} from '../forms/ConnectedField';
import {Field} from '../chakra-snippets/field';
import {Switch} from '../chakra-snippets/switch';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '../chakra-snippets/dialog';

const listFormSchema = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(20),
  emoji: z.string().trim().max(8),
  active: z.boolean(),
});

function ActiveSwitch() {
  const [field, , helpers] = useField<boolean>('active');
  return (
    <Switch
      checked={field.value}
      onCheckedChange={(e) => helpers.setValue(e.checked)}
    >
      Bude aktiv
    </Switch>
  );
}

/** Create (when `list` is null) or edit a Bude (product list). */
export function BudeDialog({
  open,
  list,
  onClose,
  onSaved,
}: {
  open: boolean;
  list: {id: number; name: string; emoji: string | null; active: boolean} | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const saveMutation = useMutation({
    mutationFn: async (values: {
      name: string;
      emoji: string;
      active: boolean;
    }) => {
      if (list) {
        await updateProductList({data: {id: list.id, ...values}});
      } else {
        await createProductList({data: values});
      }
    },
    onSuccess: () => onSaved(),
  });

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      placement="center"
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{list ? 'Bude bearbeiten' : 'Neue Bude'}</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        {open && (
          <Formik
            initialValues={{
              name: list?.name ?? '',
              emoji: list?.emoji ?? '',
              active: list?.active ?? true,
            }}
            validate={toFormikValidate(listFormSchema)}
            onSubmit={(values) => saveMutation.mutate(values)}
          >
            <Form>
              <DialogBody>
                <Stack gap="4">
                  <HStack gap="3" align="flex-start">
                    <Box w="20">
                      <Field label="Emoji">
                        <FormikField
                          name="emoji"
                          as={Input}
                          textAlign="center"
                          aria-label="Emoji"
                        />
                      </Field>
                    </Box>
                    <Box flex="1">
                      <ConnectedField name="name" label="Name" required />
                    </Box>
                  </HStack>
                  {list && <ActiveSwitch />}
                </Stack>
              </DialogBody>
              <DialogFooter>
                <Button type="submit" loading={saveMutation.isPending}>
                  {list ? 'Speichern' : 'Erstellen'}
                </Button>
              </DialogFooter>
            </Form>
          </Formik>
        )}
      </DialogContent>
    </DialogRoot>
  );
}
