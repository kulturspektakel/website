import {VStack, Text, Heading, Box, Link as ChakraLink} from '@chakra-ui/react';
import DateString from '~/components/DateString';
import {Link, Outlet, useSearchParams} from '@remix-run/react';
import {$path} from 'remix-routes';
import ApplicationPhase from '~/components/booking/ApplicationPhase';
import {useTypedRouteLoaderData} from 'remix-typedjson';
import {loader} from './booking';

export function useUtmSource() {
  const [searchParams] = useSearchParams();
  if (
    searchParams &&
    searchParams instanceof URLSearchParams &&
    searchParams.has('utm_source')
  ) {
    return searchParams.get('utm_source') ?? undefined;
  }
}

export default function Booking() {
  const event = useTypedRouteLoaderData<typeof loader>('routes/booking')!;
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
            utm_source ? {utm_source} : undefined,
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
