import {Center, Divider} from '@chakra-ui/react';
import {gql} from '@apollo/client';
import {NewsDocument, type NewsQuery} from '~/types/graphql';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import React from 'react';
import Article from '~/components/news/Article';
import apolloClient from '~/utils/apolloClient';
import type {V2_MetaFunction, LoaderArgs} from '@remix-run/node';
import LinkButton from '~/components/LinkButton';
import mergeMeta from '~/utils/mergeMeta';
import theme from '~/theme';

gql`
  query News {
    news(first: 10) {
      edges {
        node {
          ...Article
        }
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<NewsQuery>({
    query: NewsDocument,
  });
  return typedjson(data);
}

export const meta: V2_MetaFunction<typeof loader> = mergeMeta((args) => [
  {
    name: 'theme-color',
    content: theme.colors.brand[900],
  },
]);

export default function Index() {
  const data = useTypedLoaderData<typeof loader>();

  return (
    <>
      {data.news.edges.slice(0, 8).map((edge, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Divider width="60%" m="auto" mb="16" />}
          <Article key={edge.node.slug} data={edge.node} mb="12" />
        </React.Fragment>
      ))}
      <Center>
        <LinkButton href="/news/archiv">Ältere Beträge</LinkButton>
      </Center>
    </>
  );
}
