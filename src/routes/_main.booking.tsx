import {VStack, Text, Heading, Box, Link as ChakraLink} from '@chakra-ui/react';
import DateString, {dateStringComponents} from '../components/DateString';
import ApplicationPhase from '../components/booking/ApplicationPhase';
import {createFileRoute, useLoaderData} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import useFacebookPixel from '../utils/useFacebookPixel';
import {currentEventQuery} from '../server/currentEvent';

export const Route = createFileRoute('/_main/booking')({
  component: Booking,
  // `head` can't see the `/_main` layout's loader data, so it asks the query cache
  // directly. Inside a request that's the same entry the layout's loader already
  // populated, so this costs nothing.
  head: async ({match}) => {
    const {event} = await match.context.queryClient.ensureQueryData(
      currentEventQuery,
    );
    return seo({
      title: 'Band- und DJ-Bewerbungen',
      description: event.bandApplicationEnd
        ? `Die Bewerbungsphase für das ${event.name} läuft bis zum ${
            dateStringComponents({
              date: new Date(event.bandApplicationEnd),
            }).date
          }`
        : 'Aktuell keine Bewerbungen möglich',
    });
  },
});

function Booking() {
  const {event} = useLoaderData({from: '/_main'});
  const search = Route.useSearch();
  useFacebookPixel();

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
    </Box>
  );
}
