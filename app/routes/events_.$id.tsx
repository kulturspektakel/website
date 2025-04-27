import {Box, Heading, Link} from '@chakra-ui/react';
import Card from '../components/Card';
import DateString, {dateStringComponents} from '../components/DateString';
import GoogleMaps from '../components/GoogleMaps';
import Headline from '../components/Headline';
import Event, {eventSelect} from '../components/events/Event';
import truncate from '../utils/truncate';
import {prismaClient} from '../utils/prismaClient';
import {createServerFn} from '@tanstack/react-start';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {
  directusImage,
  directusImageConnection,
  imageUrl,
} from '../utils/directusImage';

export const Route = createFileRoute('/events_/$id')({
  component: EventComponent,
  loader: async ({params}) => await loader({data: params.id}),
  head: ({loaderData: {event}}) => {
    const {name, description, start, end, poster} = event;
    const {
      date,
      to = '',
      connector = '',
    } = dateStringComponents({
      date: start,
      to: end,
    });

    const meta = [
      {title: `${name} am ${date}${connector}${to}`},
      {
        name: 'description',
        content: truncate(description, 150),
      },
    ];

    if (poster) {
      meta.push({
        property: 'og:image',
        content: imageUrl(poster.id, {width: 960}),
      });
    }
    return {
      meta,
    };
  },
});

const loader = createServerFn()
  .validator((eventId: string) => eventId)
  .handler(async ({data: eventId}) => {
    const data = await prismaClient.event.findUnique({
      where: {
        id: eventId,
      },
      select: {
        ...eventSelect,
        latitude: true,
        longitude: true,
      },
    });

    if (!data) {
      throw notFound();
    }

    return {
      event: {
        ...data,
        poster: await directusImage(data.poster),
        media: await directusImageConnection('Event', eventId, 100),
      },
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    };
  });

export default function EventComponent() {
  const {event, apiKey} = Route.useLoaderData();

  return (
    <>
      <Headline
        textAlign="center"
        mark={<DateString date={event.start} to={event.end} />}
      >
        {event.name}
      </Headline>
      <Event event={event} />
      {event.location && event.latitude && event.longitude && apiKey && (
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
