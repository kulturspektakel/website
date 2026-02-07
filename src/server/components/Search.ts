import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const serverFn = createServerFn()
  .inputValidator((query: string) => query)
  .handler(({data: query}) => {
    let q = query
      .replace(/[^\p{L}0-9- ]/gu, ' ')
      .trim()
      .replace(/\s\s*/g, '<->');
    q += ':*';

    return prismaClient.bandPlaying.findMany({
      where: {
        name: {
          search: q,
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 10,
    });
  });
