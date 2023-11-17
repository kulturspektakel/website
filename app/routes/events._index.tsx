import {gql} from '@apollo/client';
import {
  Heading,
  ListItem,
  OrderedList,
  Divider,
  Box,
  Center,
  Spinner,
  Link as ChakraLink,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Event from '~/components/events/Event';
import type {EventsOverviewQuery} from '~/types/graphql';
import {EventType, EventsOverviewDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {Gallery} from 'react-photoswipe-gallery';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import Selector from '~/components/Selector';
import {useState} from 'react';
import {Link} from '@remix-run/react';
import {$path} from 'remix-routes';

gql`
  query EventsOverview($limit: Int!, $type: EventType, $num_photos: Int = 18) {
    events(limit: $limit, type: $type) {
      id
      name
      start
      end
      ...EventDetails
    }
  }
`;

const EVENT_TYPE = [
  {id: EventType.Kulturspektakel, name: 'Kulturspektakel'},
  {id: EventType.Locker, name: 'Locker'},
  {id: EventType.Other, name: 'Weitere'},
];

const INITIAL_LIMIT = 10;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<EventsOverviewQuery>({
    query: EventsOverviewDocument,
    variables: {
      limit: INITIAL_LIMIT,
    },
  });
  return typedjson({data});
}

export default function Events() {
  const [type, setType] = useState<null | EventType>(null);
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const {data} = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Heading as="h1" textAlign="center">
        Veranstaltungen
      </Heading>
      <Selector options={EVENT_TYPE} value={type} onChange={setType} />

      <OrderedList listStyleType="none" m="0" mt="20">
        <Gallery withCaption>
          {data.events.map((e, i) => (
            <ListItem key={e.id}>
              {i > 0 && <Divider m="16" />}
              <Box textAlign="center">
                <Heading size="lg" mb="1">
                  <ChakraLink
                    as={Link}
                    to={$path('/event/:id', {id: e.id.split(':')[1]})}
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
      <Center py="16">
        <Spinner />
      </Center>
    </>
  );
}
