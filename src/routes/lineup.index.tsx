import {createFileRoute, redirect} from '@tanstack/react-router';
import {prismaClient} from '../utils/prismaClient';

export const Route = createFileRoute('/lineup/')({
  loader: async () => {
    const firstEventWithBands = await prismaClient.event.findFirstOrThrow({
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

    throw redirect({
      to: '/lineup/$year',
      params: {
        year: firstEventWithBands.start.getFullYear().toString(),
      },
    });
  },
});
