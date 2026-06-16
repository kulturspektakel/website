import {
  Heading,
  ListItem,
  Separator,
  Center,
  Spinner,
  ListRoot,
  Button,
} from '@chakra-ui/react';
import Event from '../components/events/Event';
import {Gallery} from 'react-photoswipe-gallery';
import DateString from '../components/DateString';
import Headline from '../components/Headline';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn, useServerFn} from '@tanstack/react-start';
import {EventType} from '../generated/prisma/browser';
import {useInfiniteQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {seo} from '../utils/seo';
import {prismaClient} from '../server/prismaClient.server';
import {
  directusImage,
  directusImageConnection,
} from '../server/directusImage.server';
import {markdownText} from '../server/markdownText.server';
import {eventSelect} from '../components/events/Event';

const loader = createServerFn()
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
      res.map(async (e) => {
        const lineupAnnounced =
          !e.lineupAnnouncementTime || e.lineupAnnouncementTime <= new Date();
        return {
          ...e,
          BandPlaying: lineupAnnounced ? e.BandPlaying : [],
          description: e.description ? await markdownText(e.description) : null,
          poster: await directusImage(e.poster),
          media: await directusImageConnection('Event', e.id),
        };
      }),
    );
  });

const PAGE_SIZE = 10;

const EVENT_TYPE = [
  {value: 'ALL', label: 'Alle'},
  {value: EventType.Kulturspektakel, label: 'Kulturspektakel'},
  {value: EventType.Locker, label: 'Locker'},
  {value: EventType.Other, label: 'Weitere'},
];

export const Route = createFileRoute('/_main/events')({
  loader: async () => await loader({data: {eventType: 'ALL'}}),
  component: Events,
  head: () =>
    seo({
      title: 'Veranstaltungen',
      description: 'Alle Veranstaltungen des Kulturspektakel Gauting e.V.',
    }),
});

export default function Events() {
  const initialData = Route.useLoaderData();
  const [eventType, setEventType] = useState<EventType | 'ALL'>('ALL');

  const queryFn = useServerFn(loader);
  const {data, isFetchingNextPage, fetchNextPage, isFetching} =
    useInfiniteQuery({
      queryKey: ['events', eventType],
      queryFn: ({pageParam}) => queryFn({data: {eventType, cursor: pageParam}}),
      getNextPageParam: (lastPage) =>
        lastPage.length ? lastPage[lastPage.length - 1].id : undefined,
      initialPageParam: undefined as string | undefined,
      initialData: {
        pages: [
          initialData.filter(
            (e) => eventType === 'ALL' || e.eventType === eventType,
          ),
        ],
        pageParams: [],
      },
    });

  const hasNextPage = data?.pages[data.pages.length - 1].length === PAGE_SIZE;

  return (
    <>
      <Heading as="h1" textAlign="center" size="3xl">
        Veranstaltungen
      </Heading>
      <SegmentedControlOrSelect
        mt="5"
        value={eventType}
        onValueChange={(e) => setEventType(e.value as EventType | 'ALL')}
        items={EVENT_TYPE}
      />
      <ListRoot as="ol" listStyleType="none" m="0" mt="12">
        <Gallery options={{loop: false}} withCaption>
          {data?.pages.flat().map((event, i) => (
            <ListItem key={event.id}>
              {i > 0 && <Separator width="60%" my="16" mx="auto" />}
              <Headline
                textAlign="center"
                mark={<DateString date={event.start} to={event.end} />}
                href={`/events/${event.id}`}
              >
                {event.name}
              </Headline>
              <Event event={event} />
            </ListItem>
          ))}
        </Gallery>
      </ListRoot>
      {isFetching && !isFetchingNextPage && (
        <Center>
          <Spinner />
        </Center>
      )}
      {hasNextPage && (
        <Center py="16">
          <Button loading={isFetchingNextPage} onClick={() => fetchNextPage()}>
            mehr laden
          </Button>
        </Center>
      )}
    </>
  );
}
