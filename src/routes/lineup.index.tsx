import {createFileRoute, redirect} from '@tanstack/react-router';
import {prismaClient} from '../utils/prismaClient';
import {createServerFn} from '@tanstack/react-start';

const firstEventWithBands = createServerFn().handler(async () => {
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

export const Route = createFileRoute('/lineup/')({
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
