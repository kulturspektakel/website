import {Center, Separator} from '@chakra-ui/react';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';
import {newsLoader} from '../server/routes/index';

export const Route = createFileRoute('/')({
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
