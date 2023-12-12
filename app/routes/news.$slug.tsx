import {gql} from '@apollo/client';
import type {LoaderFunctionArgs, MetaFunction} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Article from '~/components/news/Article';
import {NewsPageDocument} from '~/types/graphql';
import type {NewsPageQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {V2_ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';
import mergedMeta from '~/utils/mergeMeta';

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

export const meta: MetaFunction<typeof loader> = mergedMeta((args) => {
  const result: V2_ServerRuntimeMetaDescriptor[] = [{title: args.data.title}];
  const image = args.data.content.images.at(0).small;
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
