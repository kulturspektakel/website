import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const firstEventWithBands = createServerFn().handler(async () => {
  const firstEvent = await prismaClient.event.findFirstOrThrow({
    where: {
      eventType: 'Kulturspektakel',
      BandPlaying: {
        some: {},
      },
    },
    select: {
      id: true,
      start: true,
    },
    orderBy: {
      start: 'desc',
    },
  });

  return firstEvent;
});
