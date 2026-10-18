import {createFileRoute, redirect} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {desc} from 'drizzle-orm';
import {db} from '../server/db.server';
import {event} from '../server/db/schema';
import {lineupPublished} from '../server/eventQuery.server';

const firstEventWithBands = createServerFn().handler(async () => {
  const [firstEvent] = await db
    .select({id: event.id, start: event.start})
    .from(event)
    .where(lineupPublished())
    .orderBy(desc(event.start))
    .limit(1);
  if (!firstEvent) {
    throw new Error('No festival with a published lineup');
  }

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
