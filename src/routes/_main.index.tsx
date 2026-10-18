import {Center, Separator} from '@chakra-ui/react';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {desc} from 'drizzle-orm';
import {db} from '../server/db.server';
import {news} from '../server/db/schema';
import {markdownPages} from '../server/markdownText.server';

const newsLoader = createServerFn().handler(async () => {
  const latest = await db.query.news.findMany({
    limit: 10,
    orderBy: desc(news.createdAt),
    columns: {title: true, slug: true, createdAt: true, content: true},
  });

  return {
    news: await markdownPages(latest),
  };
});

export const Route = createFileRoute('/_main/')({
  component: Index,
  loader: async () => await newsLoader(),
});

export function Index() {
  const {news} = Route.useLoaderData();

  return (
    <>
      {news.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator width="60%" m="auto" mb="16" />}
          <Article key={item.slug} data={item} mb="12" />
        </React.Fragment>
      ))}
      <Center>
        <LinkButton
          linkOptions={{
            to: '/news/archiv',
          }}
        >
          Ältere Beträge
        </LinkButton>
      </Center>
    </>
  );
}
