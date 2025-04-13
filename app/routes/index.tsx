import {Center, Separator} from '@chakra-ui/react';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownText} from '../utils/markdownText';

export const Route = createFileRoute('/')({
  component: Index,
  loader: async () => await newsLoader(),
});

const newsLoader = createServerFn().handler(async () => {
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

  return Promise.all(
    news.map(async (item) => {
      const content = await markdownText(item.content);
      return {
        ...item,
        content,
      };
    }),
  );
});

export function Index() {
  const news = Route.useLoaderData();

  return (
    <>
      {news.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator width="60%" m="auto" mb="16" />}
          <Article key={item.slug} data={item} mb="12" />
        </React.Fragment>
      ))}
      <Center>
        <LinkButton href="/news/archiv">Ältere Beträge</LinkButton>
      </Center>
    </>
  );
}
