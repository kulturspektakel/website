import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {seo} from '../utils/seo';
import {
  Box,
  Heading,
  Text,
  Image,
  VStack,
  Flex,
  HStack,
  Input,
  Button,
  Field,
} from '@chakra-ui/react';
import n2words from 'n2words/i18n/de.js';
import {z} from 'zod';
import {useMemo} from 'react';

const SearchSchema = z.object({
  id: z.string(),
});

const loader = createServerFn()
  .inputValidator(SearchSchema)
  .handler(async ({data}) =>
    prismaClient.donation.findFirstOrThrow({
      select: {
        name: true,
        amount: true,
        createdAt: true,
        source: true,
      },
      where: {
        id: data.id,
      },
    }),
  );

export const Route = createFileRoute('/spenden_/quittung')({
  loaderDeps: ({search}) => ({search}),
  loader: async ({deps}) => await loader({data: deps.search}),
  validateSearch: SearchSchema,
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

  console.log(data);

  return (
    <VStack align="stretch" gap="3">
      <Heading size="3xl">
        Bestätigung über Geldzuwendungen/Mitgliedsbeitrag
      </Heading>

      <Field.Root>
        <Field.Label>Vor- und Nachname</Field.Label>
        <Input value={data.name} />
      </Field.Root>

      <Field.Root>
        <Field.Label>Straße, Hausnummer</Field.Label>
        <Input />
      </Field.Root>

      <Field.Root>
        <Field.Label>PLZ, Ort</Field.Label>
        <Input />
      </Field.Root>

      <Button>Spendenquittung erstellen</Button>
      <Flex justifyContent="flex-end">
        <Image src="/logos/logo-wide.svg" alt="Logo" width="4cm" />
      </Flex>
      <Text>
        im Sinne des § 10b des Einkommensteuergesetzes an eine der in § 5 Abs. 1
        Nr. 9 des Körperschaftsteuergesetzes bezeichneten Körperschaften,
        Personenvereinigungen oder Vermögensmassen
      </Text>

      <Text border="1px solid black" p="2">
        Kulturspektakel Gauting e.V.
        <br />
        Bahnhofstraße 6<br />
        82131 Gauting
      </Text>

      <Text border="1px solid black" p="2">
        {data.name}
      </Text>

      <HStack border="1px solid black">
        <Text flexGrow="1" p="2" borderRight="1px solid black">
          {currency.format(data.amount / 100)}
        </Text>
        <Text flexGrow="1" p="2" borderRight="1px solid black">
          {n2words(Math.floor(data.amount / 100))} Euro
        </Text>
        <Text flexGrow="1" p="2">
          {data.createdAt.toLocaleDateString('de-DE')}
        </Text>
      </HStack>

      <Text fontSize="xs">
        Wer vorsätzlich oder grob fahrlässig eine unrichtige
        Zuwendungsbestätigung erstellt oder veranlasst, dass Zuwendungen nicht
        zu den in der Zuwendungsbestätigung angegebenen steuerbegünstigten
        Zwecken verwendet werden, haftet für die entgangene Steuer (§ 10b Abs. 4
        EStG, § 9 Abs. 3 KStG, § 9 Nr. 5 GewStG).
      </Text>
      <Text fontSize="xs">
        Diese Bestätigung wird nicht als Nachweis für die steuerliche
        Berücksichtigung der Zuwendung anerkannt, wenn das Datum des Frei-
        stellungsbescheides länger als 5 Jahre bzw. das Datum der Feststellung
        der Einhaltung der satzungsmäßigen Voraussetzungen nach § 60a Abs. 1 AO
        länger als 3 Jahre seit Ausstellung des Bescheides zurückliegt (§ 63
        Abs. 5 AO).
      </Text>
    </VStack>
  );
}
