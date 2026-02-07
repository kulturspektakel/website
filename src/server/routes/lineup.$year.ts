import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const loader = createServerFn()
  .inputValidator((data: {year: string}) => data)
  .handler(async ({data}) => {
    const bands = await prismaClient.bandPlaying.findMany({
      where: {
        eventId: `kult${data.year}`,
      },
      select: {
        name: true,
        slug: true,
        photo: true,
        startTime: true,
        genre: true,
        areaId: true,
      },
      orderBy: {
        startTime: 'asc',
      },
    });

    const areas = await prismaClient.area.findMany({
      select: {
        id: true,
        displayName: true,
        themeColor: true,
        order: true,
      },
    });

    return {
      bands,
      areas,
    };
  });
