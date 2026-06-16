import {Box, Heading, Link} from '@chakra-ui/react';
import Card from '../components/Card';
import DateString, {dateStringComponents} from '../components/DateString';
import GoogleMaps from '../components/GoogleMaps';
import Headline from '../components/Headline';
import Event from '../components/events/Event';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {seo} from '../utils/seo';
import {markdownToTxt} from 'markdown-to-txt';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../server/prismaClient.server';
import {
  directusImage,
  directusImageConnection,
} from '../server/directusImage.server';
import {markdownText} from '../server/markdownText.server';
import {eventSelect} from '../components/events/Event';

const loader = createServerFn()
  .inputValidator((eventId: string) => eventId)
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

    const lineupAnnounced =
      !data.lineupAnnouncementTime || data.lineupAnnouncementTime <= new Date();

    return {
      event: {
        ...data,
        BandPlaying: lineupAnnounced ? data.BandPlaying : [],
        description: data.description ? await markdownText(data.description) : null,
        poster: await directusImage(data.poster),
        media: await directusImageConnection('Event', eventId, 100),
      },
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    };
  });

export const Route = createFileRoute('/_main/events_/$id')({
  component: EventComponent,
  loader: async ({params}) => await loader({data: params.id}),
  head: ({loaderData}) =>
    loaderData
      ? seo({
          title: `${loaderData?.event.name} am ${
            dateStringComponents({
              date: loaderData?.event.start,
              to: loaderData?.event.end,
            }).date
          }${
            dateStringComponents({
              date: loaderData?.event.start,
              to: loaderData?.event.end,
            }).connector
          }${
            dateStringComponents({
              date: loaderData?.event.start,
              to: loaderData?.event.end,
            }).to
          }`,
          description: loaderData?.event.description
            ? markdownToTxt(loaderData.event.description.markdown)
            : undefined,
          imageId: loaderData?.event.poster?.id,
        })
      : {},
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
            >
              {event.location}
            </Link>
          </Box>
        </>
      )}
    </>
  );
}
