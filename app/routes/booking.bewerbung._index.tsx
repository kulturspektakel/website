import {gql} from '@apollo/client';
import {WarningTwoIcon} from '@chakra-ui/icons';
import {
  VStack,
  Text,
  Button,
  Heading,
  AlertIcon,
  Alert,
  AlertDescription,
  Box,
  Spacer,
  Flex,
  Tag,
} from '@chakra-ui/react';
import {EventDocument, type EventQuery} from '~/types/graphql';
import DateString from '~/components/DateString';
import apolloClient from '~/utils/apolloClient';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import {Link, Outlet} from '@remix-run/react';

export const EVENT_ID = 'Event:kult2024';

function BBox({
  href,
  disabled,
  buttonLabel,
  applicationStart,
  title,
  content,
}: {
  href: string;
  title: string;
  content: string;
  disabled: boolean;
  buttonLabel: string;
  applicationStart: Date;
}) {
  return (
    <Flex
      mt="5"
      alignItems="center"
      direction={{base: 'column', sm: 'row'}}
      bg="white"
      borderRadius="lg"
      p="4"
      shadow="xs"
    >
      <VStack align="start">
        <Heading size="sm" textAlign="left">
          {title}
        </Heading>
        <Text>
          {content}
          <br />
          <strong>Bewerbungsschluss:</strong>{' '}
          {disabled ? (
            <Tag colorScheme="red">
              <WarningTwoIcon />
              &nbsp;Abgelaufen
            </Tag>
          ) : (
            <DateString date={applicationStart} />
          )}
        </Text>
      </VStack>
      <Spacer />
      <Link to={href}>
        <Button m="3" mr="0" isDisabled={disabled} colorScheme="blue">
          {buttonLabel}
        </Button>
      </Link>
    </Flex>
  );
}

type Props = Extract<EventQuery['node'], {__typename?: 'Event'}>;

gql`
  query Event($id: ID!) {
    node(id: $id) {
      ... on Event {
        name
        start
        end
        bandApplicationStart
        bandApplicationEnd
        djApplicationEnd
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<EventQuery>({
    query: EventDocument,
    variables: {
      id: EVENT_ID,
    },
  });

  if (data?.node?.__typename === 'Event') {
    return typedjson(data.node);
  }

  throw new Error(`Event ${EVENT_ID} not found`);
}

export default function Home() {
  const data = useTypedLoaderData<typeof loader>();

  let errorMessage: string | null = null;
  const now = new Date();
  const bandApplicationEnded =
    (data.bandApplicationEnd && data.bandApplicationEnd < now) ?? false;
  const djApplicationEnded =
    (data.djApplicationEnd && data.djApplicationEnd < now) ?? false;

  if (!data.bandApplicationStart) {
    errorMessage = 'Aktuell läuft die Bewerbungsphase nicht.';
  } else if (data.bandApplicationStart > now) {
    errorMessage = `Die Bewerbungsphase beginnt am ${data.bandApplicationStart.toLocaleDateString(
      'de',
    )}`;
  } else if (bandApplicationEnded && djApplicationEnded) {
    errorMessage = `Die Bewerbungsphase für das ${data.name} ist beendet.`;
  }

  return (
    <Box>
      <Outlet />
      <VStack spacing="5">
        <Heading size="md" mt="4">
          Band- und DJ-Bewerbungen
        </Heading>
        <Text>
          Das Kulturspektakel Gauting findet vom{' '}
          <strong>
            <DateString date={data.start} to={data.end} />
          </strong>{' '}
          statt. Die Bewerbung für einen Auftritt beim Kulturspektakel ist
          ausschließlich über dieses Bewerbungsformular möglich. Alle anderen
          Anfragen bitte per E-Mail an{' '}
          <Link href="mailto:info@kulturspektakel.de" color="red.500">
            info@kulturspektakel.de
          </Link>
          .
        </Text>
        <Text>
          Nach dem Absenden des Formulars wird sich unser Booking-Team per
          E-Mail bei euch melden. Allerdings voraussichtlich erst nach Ablauf
          der Bewerbungsfrist.
        </Text>
      </VStack>

      {data.bandApplicationEnd && (
        <BBox
          applicationStart={data.bandApplicationEnd}
          title="Bands"
          content="Ihr möchtet euch als Band für eine unserer Bühnen bewerben."
          buttonLabel="Als Band bewerben"
          href="/booking/bewerbung/band/schritt1"
          disabled={bandApplicationEnded}
        />
      )}

      {data.djApplicationEnd && (
        <BBox
          applicationStart={data.djApplicationEnd}
          title="DJs"
          content="Du möchtest dich als DJ für unsere DJ-Area bewerben."
          buttonLabel="Als DJ bewerben"
          href="/booking/bewerbung/dj/schritt1"
          disabled={djApplicationEnded}
        />
      )}

      {errorMessage && (
        <Alert status="warning" borderRadius="md" mt="5">
          <AlertIcon />
          <AlertDescription color="yellow.900">{errorMessage}</AlertDescription>
        </Alert>
      )}
    </Box>
  );
}
