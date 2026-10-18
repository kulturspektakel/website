import {desc, eq} from 'drizzle-orm';
import {db} from './db.server';
import {event} from './db/schema';

export async function getCurrentEvent() {
  const current = await db.query.event.findFirst({
    where: eq(event.eventType, 'Kulturspektakel'),
    orderBy: desc(event.start),
    columns: {
      start: true,
      name: true,
      end: true,
      id: true,
      bandApplicationStart: true,
      bandApplicationEnd: true,
      djApplicationStart: true,
      djApplicationEnd: true,
    },
  });
  if (!current) {
    throw new Error('No Kulturspektakel event');
  }
  return current;
}
