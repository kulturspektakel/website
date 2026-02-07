import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {markdownText} from '../../utils/markdownText.server';
import {notFound} from '@tanstack/react-router';

export const loader = createServerFn()
  .inputValidator((slug: string) => slug)
  .handler(async ({data: slug}) => {
    const data = await prismaClient.news.findUnique({
      where: {
        slug,
      },
      select: {
        title: true,
        content: true,
        slug: true,
        createdAt: true,
      },
    });

    if (!data) {
      throw notFound();
    }

    return {
      ...data,
      content: await markdownText(data.content),
    };
  });
