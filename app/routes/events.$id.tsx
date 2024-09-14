import {gql} from '@apollo/client';
import {Box, Heading, Link} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {$params} from 'remix-routes';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Card from '~/components/Card';
import DateString, {dateStringComponents} from '~/components/DateString';
import GoogleMaps from '~/components/GoogleMaps';
import Headline from '~/components/Headline';
import Event from '~/components/events/Event';
import type {SingleEventQuery} from '~/types/graphql';
import {SingleEventDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';
import truncate from '~/utils/truncate';

gql`
  query SingleEvent($id: ID!, $num_photos: Int = 100) {
    event: node(id: $id) {
      ... on Event {
        name
        ...EventDetails
        location
        latitude
        longitude
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {id} = $params('/events/:id', args.params);
  const {data} = await apolloClient.query<SingleEventQuery>({
    query: SingleEventDocument,
    variables: {id: `Event:${id}`},
  });
  if (data.event?.__typename === 'Event') {
    return typedjson({event: data.event, apiKey: process.env.GOOGLE_MAPS_API!});
  }
  throw new Error('Not found');
}

export const meta = mergeMeta<typeof loader>(({data}) => {
  if (!data) {
    return [];
  }
  const {
    date,
    to = '',
    connector = '',
  } = dateStringComponents({
    date: new Date(data.event.start),
    to: new Date(data.event.end),
  });
  return [
    {
      title: data.event.name,
    },
    {
      name: 'description',
      content:
        truncate(data.event.description, 150) ?? `am ${date}${connector}${to}`,
    },
    {
      property: 'og:image',
      content: data.event.poster?.thumbnail,
    },
  ];
});

export default function EventComponent() {
  const {event, apiKey} = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Headline
        textAlign="center"
        mark={<DateString date={event.start} to={event.end} />}
      >
        {event.name}
      </Headline>
      <Event event={event} />
      {event.location && event.latitude && event.longitude && (
        <>
          <Heading textAlign="center" size="lg" mt="10">
            Anfahrt
          </Heading>
          <Card bg="white" aspectRatio={16 / 9} mt="5">
            <Box position="absolute" bottom="3" top="3" left="3" right="3">
              <GoogleMaps
                latitude={event.latitude}
                longitude={event.longitude}
                apiKey={apiKey}
              />
            </Box>
          </Card>
          <Box textAlign="center" mt="3">
            <Link
              href={`https://www.google.com/maps/place/${event.latitude},${event.longitude}`}
              isExternal
              variant="inline"
            >
              {event.location}
            </Link>
          </Box>
        </>
      )}
    </>
  );
}
