import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {loader, setData} from '../server/routes/spenden_.quittung.$id';
import {Heading, Text, VStack, Button, Flex} from '@chakra-ui/react';
import {useMemo} from 'react';
import DateString from '../components/DateString';
import {useMutation} from '@tanstack/react-query';
import z from 'zod';
import {FormikProvider, useFormik} from 'formik';
import {toFormikValidationSchema} from 'zod-formik-adapter';
import {ConnectedField} from '../components/ConnectedField';

const FormSchema = z.object({
  quittungStreet: z.string().min(1),
  quittungCity: z.string().min(1),
  quittungName: z.string().min(1),
});

export const Route = createFileRoute('/spenden_/quittung/$id')({
  loaderDeps: ({search}) => ({search}),
  loader: async ({params}) => await loader({data: params.id}),
  head: () =>
    seo({
      title: 'Spendenquittung',
    }),
  component: RouteComponent,
});

type LoaderData = Awaited<ReturnType<typeof loader>>;

function RouteComponent() {
  const initialData = Route.useLoaderData();
  const navigate = useNavigate();

  const {isPending, mutate} = useMutation<
    LoaderData,
    Error,
    z.infer<typeof FormSchema> & {id: string}
  >({
    onSuccess: () =>
      navigate({
        to: '/api/spenden/quittung/$id',
        params: {id: initialData.id},
        reloadDocument: true,
      }),
    mutationFn: (data) => setData({data}),
  });

  const formik = useFormik<z.infer<typeof FormSchema>>({
    initialValues: {
      quittungName: initialData.namePrivate ?? initialData.name ?? '',
      quittungStreet: '',
      quittungCity: '',
    },
    validationSchema: toFormikValidationSchema(FormSchema),
    onSubmit: (values) =>
      mutate({
        id: initialData.id,
        ...values,
      }),
  });

  const currency = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    });
  }, []);

  return (
    <VStack align="stretch" gap="3">
      <Heading size="3xl">Spendenquittung</Heading>

      <Text>
        Vielen Dank für deine Spende vom{' '}
        <strong>
          <DateString date={initialData.createdAt} />
        </strong>{' '}
        über <strong>{currency.format(initialData.amount / 100)}</strong>. Für
        deine Spendenquittung brauchen wir noch deinen vollständigen Namen und
        Anschrift.
      </Text>

      <FormikProvider value={formik}>
        <VStack gap="3" asChild>
          <form onSubmit={formik.handleSubmit}>
            <ConnectedField
              name="quittungName"
              autoComplete="name"
              label="Vor- und Nachname"
              required
            />

            <ConnectedField
              name="quittungStreet"
              autoComplete="address-line1"
              label="Straße und Hausnummer"
              required
            />

            <ConnectedField
              name="quittungCity"
              autoComplete="address-level2"
              label="PLZ und Ort"
              required
            />

            <Flex mt="2" justifyContent="flex-end">
              <Button
                type="submit"
                loading={isPending}
                disabled={!formik.isValid || formik.isSubmitting}
              >
                Spendenquittung erstellen
              </Button>
            </Flex>
          </form>
        </VStack>
      </FormikProvider>
    </VStack>
  );
}
