import {gql} from '@apollo/client';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import Article from '~/components/news/Article';
import {NewsPageDocument} from '~/types/graphql';
import type {NewsPageQuery, NewsPageSitemapQuery} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';
import mergeMeta from '~/utils/mergeMeta';
import type {SitemapFunction} from 'remix-sitemap';
import {$path} from 'remix-routes';
import truncate from '~/utils/truncate';

gql`
  query NewsPage($id: ID!) {
    node(id: $id) {
      ... on News {
        ...Article
        content {
          plainText
        }
      }
    }
  }
`;

export const sitemap: SitemapFunction = async () => {
  const {data} = await apolloClient.query<NewsPageSitemapQuery>({
    query: gql`
      query NewsPageSitemap {
        news(first: 200) {
          edges {
            node {
              id
            }
          }
        }
      }
    `,
  });
  return data.news.edges.map(({node}) => ({
    loc: $path('/news/:slug', {slug: node.id.replace(/^News:/, '')}),
  }));
};

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
  throw new Response(null, {
    status: 404,
    statusText: 'Not Found',
  });
}

export const meta = mergeMeta<typeof loader>(({data}) => {
  if (!data) {
    return [];
  }
  const result: ServerRuntimeMetaDescriptor[] = [
    {title: data.title},
    {name: 'description', content: truncate(data.content.plainText, 150)},
  ];
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
