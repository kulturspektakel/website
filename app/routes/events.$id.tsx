import {gql} from '@apollo/client';
import {Box, Heading} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Card from '~/components/Card';
import DateString from '~/components/DateString';
import GoogleMaps from '~/components/GoogleMaps';
import Mark from '~/components/Mark';
import Event from '~/components/events/Event';
import type {SingleEventQuery} from '~/types/graphql';
import {SingleEventDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  query SingleEvent($id: ID!, $num_photos: Int = 100) {
    event: node(id: $id) {
      ... on Event {
        name
        ...EventDetails
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {id} = $params('/event/:id', args.params);
  const {data} = await apolloClient.query<SingleEventQuery>({
    query: SingleEventDocument,
    variables: {id: `Event:${id}`},
  });
  if (data.event?.__typename === 'Event') {
    return typedjson({event: data.event});
  }
  throw new Error('Not found');
}

export default function EventComponent() {
  const {event} = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Box textAlign="center" mb="10">
        <Heading as="h1" textAlign="center" mb="1">
          {event.name}
        </Heading>
        <Mark fontSize="xl">
          <DateString date={event.start} to={event.end} />
        </Mark>
      </Box>
      <Event event={event} />
      <Heading textAlign="center" size="lg" mt="10">
        Anfahrt
      </Heading>
      <Card bg="white" aspectRatio={16 / 9} mt="5" p="3">
        <GoogleMaps />
      </Card>
    </>
  );
}
