import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {markdownPages} from '../../utils/markdownText.server';

export const loader = createServerFn()
  .inputValidator((cursor: string | undefined) => cursor)
  .handler(async ({data: cursor}) => {
    const data = await prismaClient.news.findMany({
      select: {
        title: true,
        content: true,
        slug: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
      skip: cursor ? 1 : 0,
      cursor: cursor ? {slug: cursor} : undefined,
    });

    return await markdownPages(data);
  });
