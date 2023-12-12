import {gql} from '@apollo/client';
import {Heading} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import type {MetaFunction} from '@remix-run/react';
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
import mergedMeta from '~/utils/mergeMeta';

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

export async function loader(args: LoaderFunctionArgs) {
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

export const meta: MetaFunction<typeof loader> = mergedMeta((props) => {
  const {
    date,
    to = '',
    connector = '',
  } = dateStringComponents({
    date: new Date(props.data.event.start),
    to: new Date(props.data.event.end),
  });
  return [
    {
      title: props.data.event.name,
    },
    {
      name: 'description',
      content: props.data.event.description ?? `am ${date}${connector}${to}`,
    },
    {
      property: 'og:image',
      content: props.data.event.poster?.thumbnail,
    },
  ];
});

export default function EventComponent() {
  const {event} = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Headline
        textAlign="center"
        mark={<DateString date={event.start} to={event.end} />}
      >
        {event.name}
      </Headline>
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
