import {gql} from '@apollo/client';
import {Heading, ListItem, OrderedList, Divider, Box} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Event from '~/components/events/Event';
import type {EventsOverviewQuery} from '~/types/graphql';
import {EventsOverviewDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {Gallery} from 'react-photoswipe-gallery';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';

gql`
  query EventsOverview {
    events(limit: 10) {
      id
      name
      start
      end
      ...EventDetails
      media(first: 18) {
        ...EventPhotos
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<EventsOverviewQuery>({
    query: EventsOverviewDocument,
  });
  return typedjson({data});
}

export default function Events() {
  const {data} = useTypedLoaderData<typeof loader>();
  return (
    <>
      <Heading as="h1" textAlign="center">
        Veranstaltungen
      </Heading>
      <OrderedList listStyleType="none" m="0" mt="20">
        <Gallery withCaption>
          {data.events.map((e, i) => (
            <ListItem key={e.id}>
              {i > 0 && <Divider m="16" />}
              <Box textAlign="center">
                <Heading size="lg" mb="1">
                  {e.name}
                </Heading>
                <Mark fontSize="lg">
                  <DateString date={e.start} to={e.end} />
                </Mark>
              </Box>
              <Event event={e} />
            </ListItem>
          ))}
        </Gallery>
      </OrderedList>
    </>
  );
}
