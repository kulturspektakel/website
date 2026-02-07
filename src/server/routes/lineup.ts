import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const lineups = createServerFn().handler(async () => {
  const lineups = await prismaClient.event.findMany({
    where: {
      eventType: 'Kulturspektakel',
      BandPlaying: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      start: true,
    },
    orderBy: {
      start: 'desc',
    },
  });

  return {
    lineups,
  };
});
