import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {directusImages} from '../../utils/directusImage.server';

export const loader = createServerFn().handler(async () => {
  const data = await prismaClient.event.findMany({
    where: {
      eventType: 'Kulturspektakel',
    },
    orderBy: {
      start: 'desc',
    },
    select: {
      id: true,
      name: true,
      start: true,
      poster: true,
    },
  });

  const images = await directusImages(data.map((event) => event.poster));
  return data.map(({poster, ...data}) => ({
    ...data,
    poster: poster ? images[poster] : null,
  }));
});
