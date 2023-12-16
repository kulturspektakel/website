import {gql} from '@apollo/client';
import {VStack, Text, Heading, Box, Link as ChakraLink} from '@chakra-ui/react';
import DateString, {dateStringComponents} from '~/components/DateString';
import type {MetaDescriptor} from '@remix-run/react';
import {Link, Outlet, useSearchParams} from '@remix-run/react';
import {$path} from 'remix-routes';
import ApplicationPhase from '~/components/booking/ApplicationPhase';
import mergeMeta from '~/utils/mergeMeta';
import {useTypedRouteLoaderData} from 'remix-typedjson';
import type {loader as rootLoader} from '~/root';

gql`
  fragment BookingDetails on Event {
    id
    name
    start
    end
    bandApplicationStart
    bandApplicationEnd
    djApplicationStart
    djApplicationEnd
  }
`;

export function useUtmSource() {
  const [utm_source] = useSearchParams();
  if (
    utm_source &&
    utm_source instanceof URLSearchParams &&
    utm_source.has('utm_source')
  ) {
    return utm_source.get('utm_source') ?? undefined;
  }
}

export const meta = mergeMeta<typeof rootLoader>(({matches}) => {
  const event = matches.find((m) => m.id === 'root')?.data.eventsConnection
    .edges[0].node;
  const result: MetaDescriptor[] = [
    {
      title: 'Band- und DJ-Bewerbungen',
    },
  ];

  if (event.bandApplicationEnd) {
    result.push({
      name: 'description',
      content: `Die Bewerbungspahse für das ${event.name} läuft bis zum ${
        dateStringComponents({date: new Date(event.bandApplicationEnd)}).date
      }`,
    });
  }
  return result;
});

export default function Home() {
  const root = useTypedRouteLoaderData<typeof rootLoader>('root')!;
  const event = root.eventsConnection.edges[0].node;
  const utm_source = useUtmSource();

  return (
    <Box>
      <Outlet />
      <VStack spacing="5">
        <Heading size="lg">Band- und DJ-Bewerbungen</Heading>
        <Text>
          Das Kulturspektakel Gauting findet vom{' '}
          <strong>
            <DateString date={event.start} to={event.end} />
          </strong>{' '}
          statt. Die Bewerbung für einen Auftritt beim Kulturspektakel ist
          ausschließlich über dieses Bewerbungsformular möglich. Alle anderen
          Anfragen bitte per E-Mail an{' '}
          <ChakraLink
            as={Link}
            to="mailto:info@kulturspektakel.de"
            color="red.500"
          >
            info@kulturspektakel.de
          </ChakraLink>
          .
        </Text>
        <Text>
          Nach dem Absenden des Formulars wird sich unser Booking-Team per
          E-Mail bei euch melden. Allerdings voraussichtlich erst nach Ablauf
          der Bewerbungsfrist.
        </Text>
      </VStack>
      {event.bandApplicationStart && (
        <ApplicationPhase
          applicationStart={event.bandApplicationStart}
          applicationEnd={event.bandApplicationEnd}
          title="Bands"
          content="Ihr möchtet euch als Band für eine unserer Bühnen bewerben."
          buttonLabel="Als Band bewerben"
          href={$path(
            '/booking/:applicationType',
            {
              applicationType: 'band',
            },
            {utm_source},
          )}
        />
      )}
      {event.djApplicationStart && (
        <ApplicationPhase
          applicationStart={event.djApplicationStart}
          applicationEnd={event.djApplicationEnd}
          title="DJs"
          content="Du möchtest dich als DJ für unsere DJ-Area bewerben."
          buttonLabel="Als DJ bewerben"
          href={$path(
            '/booking/:applicationType',
            {
              applicationType: 'dj',
            },
            {utm_source},
          )}
        />
      )}
    </Box>
  );
}
