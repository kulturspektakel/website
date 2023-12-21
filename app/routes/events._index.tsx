import {gql} from '@apollo/client';
import {
  Heading,
  ListItem,
  OrderedList,
  Divider,
  Center,
  Button,
  Spinner,
} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson} from 'remix-typedjson';
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
import Selector from '~/components/Selector';
import {useState} from 'react';
import {$path} from 'remix-routes';
import Headline from '~/components/Headline';
import mergeMeta from '~/utils/mergeMeta';

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

export const meta = mergeMeta<typeof loader>(({data}) => [
  {
    title: 'Veranstaltungen',
  },
  {
    name: 'description',
    content: 'Alle Veranstaltungen des Kulturspektakel Gauting e.V.',
  },
]);

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<EventsOverviewQuery>({
    query: EventsOverviewDocument,
  });
  return typedjson(data);
}

export default function Events() {
  const [variables, setVariables] = useState<EventsOverviewQueryVariables>();
  const {data, fetchMore, loading} = useEventsOverviewQuery({
    variables,
    notifyOnNetworkStatusChange: true,
  });

  return (
    <>
      <Heading as="h1" textAlign="center">
        Veranstaltungen
      </Heading>
      <Selector
        options={EVENT_TYPE}
        value={variables?.type ?? null}
        allLabelSmall="Alle Veranstaltungen"
        onChange={(type) =>
          setVariables(
            type == null ? undefined : {type: type as EventType, cursor: null},
          )
        }
      />
      <OrderedList listStyleType="none" m="0" mt="20">
        <Gallery options={{loop: false}} withCaption>
          {data?.eventsConnection.edges.map(({node: e}, i) => (
            <ListItem key={e.id}>
              {i > 0 && <Divider width="60%" my="16" mx="auto" />}
              <Headline
                textAlign="center"
                mark={<DateString date={e.start} to={e.end} />}
                href={$path('/events/:id', {id: e.id.split(':')[1]})}
              >
                {e.name}
              </Headline>
              <Event event={e} />
            </ListItem>
          ))}
        </Gallery>
      </OrderedList>
      {!data && loading && (
        <Center>
          <Spinner />
        </Center>
      )}
      {data?.eventsConnection.pageInfo.hasNextPage && (
        <Center py="16">
          <Button
            isLoading={loading}
            onClick={() =>
              fetchMore({
                variables: {
                  ...variables,
                  cursor: data?.eventsConnection.edges.slice(-1)[0].cursor,
                },
                updateQuery: ({eventsConnection}, {fetchMoreResult}) => {
                  return {
                    eventsConnection: {
                      ...fetchMoreResult.eventsConnection,
                      edges: [
                        ...eventsConnection.edges,
                        ...fetchMoreResult.eventsConnection.edges,
                      ],
                    },
                  };
                },
              })
            }
          >
            mehr laden
          </Button>
        </Center>
      )}
    </>
  );
}
