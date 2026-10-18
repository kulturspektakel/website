import {and, desc, eq, exists, isNull, lte, or, sql, type SQL} from 'drizzle-orm';
import type {EventType} from '../utils/enums';
import {db} from './db.server';
import {bandPlaying, event} from './db/schema';

// What an event card shows: the event and the names of the bands that played
// (as `BandPlaying`, the shape components/events/Event.tsx renders).
const eventColumns = {
  id: true,
  name: true,
  description: true,
  location: true,
  start: true,
  end: true,
  poster: true,
  eventType: true,
  lineupAnnouncementTime: true,
  immichAlbumShareUrl: true,
} as const;

const withBandNames = {bandPlayings: {columns: {name: true}}} as const;

const toEventCard = <E extends {bandPlayings: {name: string}[]}>({
  bandPlayings,
  ...rest
}: E) => ({...rest, BandPlaying: bandPlayings});

// One page of events, newest first. `cursor` is the id of the last event of the
// previous page; ties on `start` are broken by id so no event is skipped or
// repeated across pages.
export async function listEvents({
  eventType,
  cursor,
  limit,
}: {
  eventType?: EventType;
  cursor?: string;
  limit: number;
}) {
  const events = await db.query.event.findMany({
    columns: eventColumns,
    with: withBandNames,
    where: (e) => {
      const conditions: SQL[] = [];
      if (eventType) {
        conditions.push(eq(e.eventType, eventType));
      }
      if (cursor) {
        conditions.push(
          sql`(${e.start}, ${e.id}) < (select "start", "id" from ${event} where "id" = ${cursor})`,
        );
      }
      return and(...conditions);
    },
    orderBy: [desc(event.start), desc(event.id)],
    limit,
  });
  return events.map(toEventCard);
}

export async function findEvent(id: string) {
  const found = await db.query.event.findFirst({
    columns: {...eventColumns, latitude: true, longitude: true},
    with: withBandNames,
    where: eq(event.id, id),
  });
  return found && toEventCard(found);
}

// Festivals whose lineup is out: it has bands, and its announcement time (if
// any) has passed.
export const lineupPublished = () =>
  and(
    eq(event.eventType, 'Kulturspektakel'),
    exists(
      db
        .select({id: bandPlaying.id})
        .from(bandPlaying)
        .where(eq(bandPlaying.eventId, event.id)),
    ),
    or(
      lte(event.lineupAnnouncementTime, new Date()),
      isNull(event.lineupAnnouncementTime),
    ),
  );
