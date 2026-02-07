import {prismaClient} from './prismaClient.server';

export async function getCurrentEvent() {
  const event = await prismaClient.event.findFirstOrThrow({
    where: {
      eventType: 'Kulturspektakel',
    },
    orderBy: {
      start: 'desc',
    },
    select: {
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
  return event;
}
