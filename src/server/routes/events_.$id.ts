import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {directusImage, directusImageConnection} from '../../utils/directusImage.server';
import {eventSelect} from '../../components/events/Event';
import {notFound} from '@tanstack/react-router';

export const loader = createServerFn()
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

    return {
      event: {
        ...data,
        poster: await directusImage(data.poster),
        media: await directusImageConnection('Event', eventId, 100),
      },
      apiKey: process.env.GOOGLE_MAPS_API_KEY,
    };
  });
