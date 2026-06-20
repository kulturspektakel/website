import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {Stack} from '@chakra-ui/react';
import Page from '../components/Page';
import {seo} from '../utils/seo';
import {pageLoader} from '../server/pageLoader';
import {prismaClient} from '../server/prismaClient.server';
import {AwarenessBox} from '../components/awareness/AwarenessBox';

// The awareness team is reachable when the current moment falls within an
// opening-hour interval of the "gb" area (Geländebüro). startTime/endTime are
// absolute instants, so a plain now-between check needs no timezone handling.
// When closed, also return the next interval's start so we can tell people when
// we're back.
const awarenessAvailability = createServerFn().handler(async () => {
  const now = new Date();
  const open = await prismaClient.areaOpeningHour.findFirst({
    where: {areaId: 'gb', startTime: {lte: now}, endTime: {gte: now}},
    select: {id: true},
  });
  if (open) {
    return {available: true as const, nextOpen: null};
  }
  const next = await prismaClient.areaOpeningHour.findFirst({
    where: {areaId: 'gb', startTime: {gt: now}},
    orderBy: {startTime: 'asc'},
    select: {startTime: true},
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
