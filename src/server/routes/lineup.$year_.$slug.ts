import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {directusImage} from '../../utils/directusImage.server';
import {notFound} from '@tanstack/react-router';

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

    return {
      ...band,
      photo: await directusImage(band.photo),
    };
  });
