import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {directusImage, directusImageConnection} from '../../utils/directusImage.server';
import {eventSelect} from '../../components/events/Event';
import {EventType} from '../../generated/prisma/browser';

export const loader = createServerFn()
  .inputValidator(
    (cursor: {cursor?: string; eventType: EventType | 'ALL'}) => cursor,
  )
  .handler(async ({data}) => {
    const res = await prismaClient.event.findMany({
      select: eventSelect,
      orderBy: {
        start: 'desc',
      },
      where: {
        eventType:
          data && data.eventType !== 'ALL' ? data.eventType : undefined,
      },
      take: 10,
      skip: data?.cursor ? 1 : 0,
      cursor: data?.cursor ? {id: data.cursor} : undefined,
    });

    return Promise.all(
      res.map(async (e) => ({
        ...e,
        poster: await directusImage(e.poster),
        media: await directusImageConnection('Event', e.id),
      })),
    );
  });
