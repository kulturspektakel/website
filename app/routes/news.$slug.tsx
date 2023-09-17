import {gql} from '@apollo/client';
import type {LoaderArgs, V2_MetaFunction} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Article from '~/components/Article';
import {NewsPageDocument} from '~/types/graphql';
import type {NewsPageQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {mergeMeta} from '~/utils/mergeMeta';

gql`
  query NewsPage($id: ID!) {
    node(id: $id) {
      ... on News {
        ...Article
      }
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<NewsPageQuery>({
    query: NewsPageDocument,
    variables: {
      id: `News:${args.params.slug}`,
    },
  });
  if (data.node?.__typename === 'News') {
    return typedjson(data.node);
  }
  throw new Error('not found');
}

export const meta: V2_MetaFunction = mergeMeta((args) => {
  return [{title: args.data.title}];
});

export default function News() {
  const data = useTypedLoaderData<typeof loader>();
  return <Article {...data} />;
}
