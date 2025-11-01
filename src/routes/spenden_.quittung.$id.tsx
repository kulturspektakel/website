import {createFileRoute, redirect, useNavigate} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {seo} from '../utils/seo';
import {
  Heading,
  Text,
  VStack,
  Input,
  Button,
  Field,
  Flex,
  Link,
} from '@chakra-ui/react';
import {useMemo, useState} from 'react';
import DateString from '../components/DateString';
import {useMutation} from '@tanstack/react-query';

const loader = createServerFn()
  .inputValidator((id: string) => id)
  .handler(async ({data: id}) => {
    const data = await prismaClient.donation.findFirstOrThrow({
      select: {
        id: true,
        namePrivate: true,
        amount: true,
        createdAt: true,
        source: true,
        spendenQuittungAt: true,
      },
      where: {
        id,
      },
    });

    if (data.spendenQuittungAt) {
      throw redirect({
        to: '/api/spenden/quittung/$id',
        params: {id: data.id},
      });
    }

    return data;
  });

const setData = createServerFn()
  .inputValidator(
    (input: {id: string; name: string; street: string; city: string}) => input,
  )
  .handler(async ({data}) => {
    const result = await prismaClient.donation.update({
      where: {
        id: data.id,
        spendenQuittungAt: {
          equals: null,
        },
      },
      data: {
        quittungName: data.name,
        quittungStreet: data.street,
        quittungCity: data.city,
        spendenQuittungAt: new Date(),
      },
    });
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

function RouteComponent() {
  const data = Route.useLoaderData();
  const [name, setName] = useState(data.namePrivate ?? '');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const navigate = useNavigate();

  const {isPending, isSuccess, isError, mutate} = useMutation<
    void,
    Error,
    {
      id: string;
      name: string;
      street: string;
      city: string;
    }
  >({
    onSuccess: () =>
      navigate({
        to: '/api/spenden/quittung/$id',
        params: {id: data.id},
        reloadDocument: true,
      }),
    mutationFn: (data) =>
      setData({
        data,
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
          <DateString date={data.createdAt} />
        </strong>{' '}
        über <strong>{currency.format(data.amount / 100)}</strong>. Für deine
        Spendenquittung brauchen wir noch deinen vollständigen Namen und
        Anschrift:
      </Text>

      <VStack gap="3" asChild>
        <form action={`/api/spenden/quittung/${data.id}`} method="POST">
          <Field.Root required>
            <Field.Label>
              Vor- und Nachname
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              value={name}
              name="name"
              required
              onChange={(e) => setName(e.target.value)}
            />
          </Field.Root>

          <Field.Root required>
            <Field.Label>
              Straße, Hausnummer
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              name="street"
              required
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </Field.Root>

          <Field.Root required>
            <Field.Label>
              PLZ, Ort
              <Field.RequiredIndicator />
            </Field.Label>
            <Input
              name="city"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </Field.Root>

          <Flex mt="2" justifyContent="flex-end">
            <Button
              onClick={() =>
                mutate({
                  id: data.id,
                  name,
                  street,
                  city,
                })
              }
              loading={isPending || isSuccess || isError}
            >
              Spendenquittung erstellen
            </Button>
          </Flex>
        </form>
      </VStack>
    </VStack>
  );
}
