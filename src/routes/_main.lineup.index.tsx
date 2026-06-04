import {createFileRoute, redirect} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../server/prismaClient.server';

const firstEventWithBands = createServerFn().handler(async () => {
  const firstEvent = await prismaClient.event.findFirstOrThrow({
    where: {
      eventType: 'Kulturspektakel',
      BandPlaying: {
        some: {},
      },
      OR: [
        {lineupAnnouncementTime: {lte: new Date()}},
        {lineupAnnouncementTime: null},
      ],
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

export const Route = createFileRoute('/_main/lineup/')({
  loader: async () => {
    const firstEvent = await firstEventWithBands();

    throw redirect({
      to: '/lineup/$year',
      params: {
        year: firstEvent.start.getFullYear().toString(),
      },
    });
  },
});
