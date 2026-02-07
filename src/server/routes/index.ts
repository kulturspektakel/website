import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {markdownPages} from '../../utils/markdownText.server';

export const newsLoader = createServerFn().handler(async () => {
  const news = await prismaClient.news.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      title: true,
      slug: true,
      createdAt: true,
      content: true,
    },
  });

  return {
    news: await markdownPages(news),
  };
});
