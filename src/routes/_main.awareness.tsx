import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {Stack} from '@chakra-ui/react';
import Page from '../components/Page';
import {seo} from '../utils/seo';
import {pageLoader} from '../server/pageLoader';
import {and, asc, eq, gt, gte, lte} from 'drizzle-orm';
import {db} from '../server/db.server';
import {areaOpeningHour} from '../server/db/schema';
import {AwarenessBox} from '../components/awareness/AwarenessBox';

// The awareness team is reachable when the current moment falls within an
// opening-hour interval of the "gb" area (Geländebüro). startTime/endTime are
// absolute instants, so a plain now-between check needs no timezone handling.
// When closed, also return the next interval's start so we can tell people when
// we're back.
const awarenessAvailability = createServerFn().handler(async () => {
  const now = new Date();
  const open = await db.query.areaOpeningHour.findFirst({
    where: and(
      eq(areaOpeningHour.areaId, 'gb'),
      lte(areaOpeningHour.startTime, now),
      gte(areaOpeningHour.endTime, now),
    ),
    columns: {id: true},
  });
  if (open) {
    return {available: true as const, nextOpen: null};
  }
  const next = await db.query.areaOpeningHour.findFirst({
    where: and(
      eq(areaOpeningHour.areaId, 'gb'),
      gt(areaOpeningHour.startTime, now),
    ),
    orderBy: asc(areaOpeningHour.startTime),
    columns: {startTime: true},
  });
  return {available: false as const, nextOpen: next?.startTime ?? null};
});

// Static route — takes precedence over `_main.$slug` for `/awareness`, so it
// renders the same DB-backed markdown page but with the awareness box on top.
export const Route = createFileRoute('/_main/awareness')({
  component: AwarenessRoute,
  loader: async () => {
    const [data, availability] = await Promise.all([
      pageLoader({data: 'awareness'}),
      awarenessAvailability(),
    ]);
    if (!data) {
      throw notFound();
    }
    return {...data, ...availability};
  },
  head: ({loaderData}) =>
    loaderData
      ? seo({
          title: loaderData.title,
          description: loaderData.content?.markdown,
        })
      : {},
});

function AwarenessRoute() {
  const {available, nextOpen, ...page} = Route.useLoaderData();
  return (
    <Stack gap="6" w="100%">
      <AwarenessBox available={available} nextOpen={nextOpen} />
      <Page {...page} />
    </Stack>
  );
}
