import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {directusImage} from '../../utils/directusImage.server';
import {notFound} from '@tanstack/react-router';
import {isSameDay} from '../../utils/dateUtils';

export const loader = createServerFn()
  .inputValidator((data: {year: string; slug: string}) => data)
  .handler(async ({data}) => {
    const band = await prismaClient.bandPlaying.findUnique({
      where: {
        eventId_slug: {
          eventId: `kult${data.year}`,
          slug: data.slug,
        },
      },
      select: {
        name: true,
        slug: true,
        photo: true,
        startTime: true,
        genre: true,
        spotify: true,
        youtube: true,
        instagram: true,
        facebook: true,
        website: true,
        soundcloud: true,
        shortDescription: true,
        description: true,
        area: {
          select: {
            id: true,
            displayName: true,
            themeColor: true,
          },
        },
      },
    });

    if (!band) {
      throw notFound();
    }

    const neighborSelect = {
      name: true,
      slug: true,
      startTime: true,
    };

    const [previous, next] = await Promise.all([
      prismaClient.bandPlaying.findFirst({
        where: {
          eventId: `kult${data.year}`,
          areaId: band.area.id,
          startTime: {lt: band.startTime},
        },
        orderBy: {startTime: 'desc'},
        select: neighborSelect,
      }),
      prismaClient.bandPlaying.findFirst({
        where: {
          eventId: `kult${data.year}`,
          areaId: band.area.id,
          startTime: {gt: band.startTime},
        },
        orderBy: {startTime: 'asc'},
        select: neighborSelect,
      }),
    ]);

    return {
      ...band,
      photo: await directusImage(band.photo),
      previous:
        previous && isSameDay(previous.startTime, band.startTime)
          ? previous
          : null,
      next: next && isSameDay(next.startTime, band.startTime) ? next : null,
    };
  });
