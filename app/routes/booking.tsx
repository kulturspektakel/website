import {VStack, Text, Heading, Box, Link as ChakraLink} from '@chakra-ui/react';
import DateString, {dateStringComponents} from '../components/DateString';
import ApplicationPhase from '../components/booking/ApplicationPhase';
import {createFileRoute} from '@tanstack/react-router';

export const Route = createFileRoute('/booking')({
  component: Booking,
  head: ({match: {context}}) => ({
    meta: [
      {
        title: 'Band- und DJ-Bewerbungen',
      },
      context.event.bandApplicationEnd
        ? {
            name: 'description',
            content: `Die Bewerbungspahse für das ${context.event.name} läuft bis zum ${
              dateStringComponents({
                date: new Date(context.event.bandApplicationEnd),
              }).date
            }`,
          }
        : undefined,
    ],
  }),
});

function Booking() {
  const {event} = Route.useRouteContext();
  const search = Route.useSearch();

  return (
    <Box>
      <VStack gap="5">
        <Heading size="3xl">Band- und DJ-Bewerbungen</Heading>
        <Text>
          Das Kulturspektakel Gauting findet vom{' '}
          <strong>
            <DateString date={event.start} to={event.end} />
          </strong>{' '}
          statt. Die Bewerbung für einen Auftritt beim Kulturspektakel ist
          ausschließlich über dieses Bewerbungsformular möglich. Alle anderen
          Anfragen bitte per E-Mail an{' '}
          <ChakraLink href="mailto:info@kulturspektakel.de" color="red.500">
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
          link={{
            to: '/booking/$applicationType',
            params: {
              applicationType: 'band',
            },
            search,
          }}
        />
      )}
      {event.djApplicationStart && (
        <ApplicationPhase
          applicationStart={event.djApplicationStart}
          applicationEnd={event.djApplicationEnd}
          title="DJs"
          content="Du möchtest dich als DJ für unsere DJ-Area bewerben."
          buttonLabel="Als DJ bewerben"
          link={{
            to: '/booking/$applicationType',
            params: {
              applicationType: 'dj',
            },
            search,
          }}
        />
      )}
    </Box>
  );
}
