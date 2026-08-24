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
      // Without this the 307 goes out as `max-age=0, must-revalidate`: the
      // header `_main` sets in its loader doesn't survive redirect handling,
      // so every hit on /lineup ran the query above and missed the CDN. Edge
      // only (`max-age=0`), so the year rolling over isn't pinned in browsers.
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600',
      },
    });
  },
});
