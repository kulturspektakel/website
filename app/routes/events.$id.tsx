import {gql} from '@apollo/client';
import {Box, Heading} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import DateString from '~/components/DateString';
import Mark from '~/components/Mark';
import Event from '~/components/events/Event';
import type {SingleEventQuery} from '~/types/graphql';
import {SingleEventDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  query SingleEvent($id: ID!) {
    event: node(id: $id) {
      ... on Event {
        name
        ...EventDetails
        media(first: 100) {
          ...EventPhotos
        }
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {id} = $params('/events/:id', args.params);
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
        <Heading as="h1" textAlign="center">
          {event.name}
        </Heading>
        <Mark fontSize="2xl">
          <DateString date={event.start} to={event.end} />
        </Mark>
      </Box>
      <Event event={event} />
    </>
  );
}
