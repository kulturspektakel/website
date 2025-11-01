import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {seo} from '../utils/seo';
import {
  Heading,
  Text,
  HStack,
  VStack,
  Input,
  Button,
  Field,
  Flex,
  Link,
} from '@chakra-ui/react';
import {useMemo} from 'react';
import DateString from '../components/DateString';

const loader = createServerFn()
  .inputValidator((id: string) => id)
  .handler(async ({data: id}) =>
    prismaClient.donation.findFirstOrThrow({
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
    }),
  );

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

  const currency = useMemo(() => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    });
  }, []);

  return (
    <VStack align="stretch" gap="3">
      <Heading size="3xl">Spendenquittung</Heading>

      {data.spendenQuittungAt ? (
        <>
          <Text>
            Deine Spendenquittung für die Spende vom{' '}
            <strong>
              <DateString date={data.createdAt} />
            </strong>{' '}
            über <strong>{currency.format(data.amount / 100)}</strong> wurde
            bereits erstellt. Falls du sie erneut benötigst, melde dich bitte
            bei uns unter{' '}
            <Link href="mailto:kasse@kulturspektakel.de">
              kasse@kulturspektakel.de
            </Link>
            .
          </Text>
        </>
      ) : (
        <>
          <Text>
            Vielen Dank für deine Spende vom{' '}
            <strong>
              <DateString date={data.createdAt} />
            </strong>{' '}
            über <strong>{currency.format(data.amount / 100)}</strong>. Für
            deine Spendenquittung brauchen wir noch deinen vollständigen Namen
            und Anschrift:
          </Text>

          <VStack gap="3" asChild>
            <form action="/api/spendenquittung" method="POST">
              <input type="hidden" name="id" value={data.id} />
              <Field.Root required>
                <Field.Label>
                  Vor- und Nachname
                  <Field.RequiredIndicator />
                </Field.Label>
                <Input
                  defaultValue={data.namePrivate ?? ''}
                  name="name"
                  required
                />
              </Field.Root>

              <Field.Root required>
                <Field.Label>
                  Straße, Hausnummer
                  <Field.RequiredIndicator />
                </Field.Label>
                <Input name="street" required />
              </Field.Root>

              <Field.Root required>
                <Field.Label>
                  PLZ, Ort
                  <Field.RequiredIndicator />
                </Field.Label>
                <Input name="city" required />
              </Field.Root>

              <Flex mt="2" justifyContent="flex-end">
                <Button type="submit">Spendenquittung erstellen</Button>
              </Flex>
            </form>
          </VStack>
        </>
      )}
    </VStack>
  );
}
