import {gql} from '@apollo/client';
import {
  Heading,
  ListItem,
  OrderedList,
  Divider,
  Box,
  Center,
  Link as ChakraLink,
  Button,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Event from '~/components/events/Event';
import type {
  EventsOverviewQuery,
  EventsOverviewQueryVariables,
} from '~/types/graphql';
import {
  EventType,
  EventsOverviewDocument,
  useEventsOverviewQuery,
} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {Gallery} from 'react-photoswipe-gallery';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import Selector from '~/components/Selector';
import {useState} from 'react';
import {Link} from '@remix-run/react';
import {$path} from 'remix-routes';

gql`
  query EventsOverview(
    $cursor: String
    $type: EventType
    $num_photos: Int = 15
  ) {
    eventsConnection(type: $type, first: 10, after: $cursor) {
      pageInfo {
        hasNextPage
      }
      edges {
        cursor
        node {
          id
          name
          start
          end
          ...EventDetails
        }
      }
    }
  }
`;

const EVENT_TYPE = [
  {id: EventType.Kulturspektakel, name: 'Kulturspektakel'},
  {id: EventType.Locker, name: 'Locker'},
  {id: EventType.Other, name: 'Weitere'},
];

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<EventsOverviewQuery>({
    query: EventsOverviewDocument,
  });
  return typedjson({data});
}

export default function Events() {
  const [variables, setVariables] = useState<EventsOverviewQueryVariables>();
  const {data: initialData} = useTypedLoaderData<typeof loader>();
  // not using Apollo's loading state because it will initially be true
  const [loading, setLoading] = useState(false);

  const {data: apolloData, fetchMore} = useEventsOverviewQuery({
    variables,
    notifyOnNetworkStatusChange: true,
  });

  const data = apolloData ?? initialData;

  return (
    <>
      <Heading as="h1" textAlign="center">
        Veranstaltungen
      </Heading>
      <Selector
        options={EVENT_TYPE}
        value={variables?.type ?? null}
        onChange={(type) =>
          setVariables(type == null ? null : {type, cursor: null})
        }
      />
      <OrderedList listStyleType="none" m="0" mt="20">
        <Gallery options={{loop: false}} withCaption>
          {data.eventsConnection.edges.map(({node: e}, i) => (
            <ListItem key={e.id}>
              {i > 0 && <Divider m="16" />}
              <Box textAlign="center">
                <Heading size="lg" mb="1">
                  <ChakraLink
                    as={Link}
                    to={$path('/events/:id', {id: e.id.split(':')[1]})}
                  >
                    {e.name}
                  </ChakraLink>
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
      {data.eventsConnection.pageInfo.hasNextPage && (
        <Center py="16">
          <Button
            isLoading={loading}
            onClick={() => {
              setLoading(true);
              return fetchMore({
                variables: {
                  ...variables,
                  cursor: data.eventsConnection.edges.slice(-1)[0].cursor,
                },
                updateQuery: (
                  {eventsConnection = initialData.eventsConnection},
                  {fetchMoreResult},
                ) => ({
                  eventsConnection: {
                    ...fetchMoreResult.eventsConnection,
                    edges: [
                      ...eventsConnection.edges,
                      ...fetchMoreResult.eventsConnection.edges,
                    ],
                  },
                }),
              }).finally(() => setLoading(false));
            }}
          >
            mehr laden
          </Button>
        </Center>
      )}
    </>
  );
}