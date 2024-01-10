import {gql} from '@apollo/client';
import {
  Heading,
  ListItem,
  OrderedList,
  VStack,
  Text,
  Link,
  Box,
} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import type {InfosQuery} from '~/types/graphql';
import {InfosDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import Page from '~/components/Page';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Infos {
    crewCalendar {
      summary
      start
      end
      uid
      location
      allDay
    }
    infos: node(id: "Page:infos") {
      ... on Page {
        id
        ...PageContent
      }
    }
    verein: node(id: "Page:verein") {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
`;

export const meta = mergeMeta<typeof loader>(({data}) => [
  {
    title:
      data?.infos?.__typename === 'Page' ? data.infos.title : 'Informationen',
  },
  {
    name: 'description',
    content: 'Informationen zum Kulturspektakel und dem Verein dahinter',
  },
]);

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<InfosQuery>({
    query: InfosDocument,
  });
  return typedjson(data);
}

export default function Angebot() {
  const data = useTypedLoaderData<typeof loader>();
  return (
    <VStack spacing="10">
      {data.infos && data.infos.__typename === 'Page' && (
        <Page {...data.infos} centered />
      )}
      {data.verein && data.verein.__typename === 'Page' && (
        <Page {...data.verein} />
      )}
      <Box w="100%" textAlign="center">
        <Heading mb="5">Termine</Heading>
        <OrderedList
          listStyleType="none"
          m="0"
          w="100%"
          sx={{columnCount: [1, 2, 3]}}
          mb="4"
        >
          {data.crewCalendar.map((event) => (
            <ListItem key={event.uid} mb="4">
              <Mark>
                <DateString
                  options={{
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric',
                  }}
                  date={event.start}
                  to={
                    event.allDay
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
              {event.location}
            </ListItem>
          ))}
        </OrderedList>
        <Link
          variant="inline"
          href="https://calendar.google.com/calendar/ical/kulturspektakel.de_r2rcls69e282dtq2dq19keu7o4%40group.calendar.google.com/private-df072e4d5a0624624d47d3af04deb9de/basic.ics"
        >
          Kalendar abonnieren
        </Link>
      </Box>
    </VStack>
  );
}
