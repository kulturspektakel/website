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
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import type {InfosQuery} from '~/types/graphql';
import {InfosDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import Page from '~/components/Page';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';

gql`
  query Infos {
    crewCalendar {
      summary
      start
      uid
      location
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

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<InfosQuery>({
    query: InfosDocument,
  });
  return typedjson({data});
}

export default function Angebot() {
  const {data} = useTypedLoaderData<typeof loader>();
  return (
    <VStack spacing="10">
      {data.infos && data.infos.__typename === 'Page' && (
        <Page {...data.infos} centered />
      )}
      {data.verein && data.verein.__typename === 'Page' && (
        <Page {...data.verein} />
      )}
      <Box w="100%">
        <Heading mb="5">Termine</Heading>
        <OrderedList listStyleType="none" m="0" w="100%">
          {data.crewCalendar.map((event) => (
            <ListItem key={event.uid} mb="4">
              <Mark>
                <DateString
                  options={{
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  }}
                  date={event.start}
                />
              </Mark>
              <Text>
                <DateString
                  date={event.start}
                  timeOnly
                  options={{hour: '2-digit', minute: '2-digit'}}
                />
                &nbsp;Uhr&nbsp;
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
