import {Heading, ListItem, VStack, Text, Box, ListRoot} from '@chakra-ui/react';
import Page from '../components/Page';
import DateString from '../components/DateString';
import Mark from '../components/Mark';
import {LinkButton} from '../components/chakra-snippets/link-button';
import {createServerFn} from '@tanstack/react-start';
import {createFileRoute} from '@tanstack/react-router';
import {multiPage} from '../utils/markdownText';
import {convertIcsCalendar, type IcsCalendar} from 'ts-ics';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/infos')({
  component: Infos,
  loader: async () => await loader(),
  head: () =>
    seo({
      title: 'Informationen',
      description: 'Informationen zum Kulturspektakel und dem Verein dahinter',
    }),
});

const loader = createServerFn().handler(async () => {
  const calendarUrl =
    'https://calendar.google.com/calendar/ical/c_d5cfc52054d3dae0761245fee799a7c2c61691fb62554f30ea652adcca183304%40group.calendar.google.com/public/basic.ics';

  const cal = await fetch(calendarUrl).then((res) => res.text());

  return {
    crewCalendar:
      convertIcsCalendar<IcsCalendar>(undefined, cal)
        ?.events?.map((e) => ({
          start: e.start.date,
          end: e.end?.date,
          id: e.uid,
          summary: e.summary,
          // Google Calendar escapes commas in the location field with a backslash
          location: e.location?.replace(/\\,/g, ','),
          allDay: e.start.type === 'DATE',
        }))
        .filter((e) => e.start.getTime() > Date.now())
        .sort((a, b) => a.start.getTime() - b.start.getTime()) ?? [],
    calendarUrl,
    pages: await multiPage(['infos', 'verein']),
  };
});

export default function Infos() {
  const {pages, calendarUrl, crewCalendar} = Route.useLoaderData();

  return (
    <VStack gap="10">
      {pages.infos && <Page {...pages.infos} centered />}
      {pages.verein && <Page headingLevel={2} {...pages.verein} />}
      <Box w="100%" textAlign="center">
        <Heading as="h2" mb="5">
          Termine
        </Heading>
        <ListRoot
          as="ol"
          display="block"
          listStyleType="none"
          m="0"
          w="100%"
          columnCount={[1, 2, 3]}
          mb="4"
        >
          {crewCalendar.map((event) => (
            <ListItem key={event.id} mb="4" breakInside="avoid">
              <Mark>
                <DateString
                  options={{
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                  }}
                  date={event.start}
                  to={
                    event.allDay && event.end
                      ? new Date(event.end.getTime() - 2 * 60 * 60 * 1000 - 1) // it's not nice but CE(S)T is a maximum of 2 hours ahead of UTC
                      : event.end
                  }
                />
              </Mark>
              <Text>
                {!event.allDay && (
                  <>
                    <DateString
                      date={event.start}
                      timeOnly
                      options={{hour: '2-digit', minute: '2-digit'}}
                    />
                    &nbsp;Uhr&nbsp;
                  </>
                )}
                <Text fontWeight="bold" as="span">
                  {event.summary}
                </Text>
              </Text>
              {event.location?.split(',')[0]}
            </ListItem>
          ))}
        </ListRoot>
        <LinkButton href={calendarUrl}>Kalendar abonnieren</LinkButton>
      </Box>
    </VStack>
  );
}
