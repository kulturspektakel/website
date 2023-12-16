import {gql} from '@apollo/client';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Article from '~/components/news/Article';
import {NewsPageDocument} from '~/types/graphql';
import type {NewsPageQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query NewsPage($id: ID!) {
    node(id: $id) {
      ... on News {
        ...Article
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
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

export const meta = mergeMeta<typeof loader>(({data}) => {
  if (!data) {
    return [];
  }
  const result: ServerRuntimeMetaDescriptor[] = [{title: data.title}];
  const image = data.content.images[0]?.small;
  if (image) {
    result.push({
      property: 'og:image',
      content: image,
    });
  }
  return result;
});

export default function News() {
  const data = useTypedLoaderData<typeof loader>();
  return <Article data={data} />;
}
