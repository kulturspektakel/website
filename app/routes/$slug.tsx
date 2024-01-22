import {gql} from '@apollo/client';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import PageComponent from '~/components/Page';
import type {PageQuery} from '~/types/graphql';
import {PageDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import type {ServerRuntimeMetaDescriptor} from '@remix-run/server-runtime';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Page($id: ID!) {
    node(id: $id) {
      ... on Page {
        id
        ...PageContent
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<PageQuery>({
    query: PageDocument,
    variables: {
      id: `Page:${args.params.slug}`,
    },
  });
  if (data.node?.__typename === 'Page') {
    return typedjson(data.node);
  }
  throw new Response(null, {
    status: 404,
    statusText: 'Not Found',
  });
}

export const meta = mergeMeta<typeof loader>(({data}) => {
  const result: ServerRuntimeMetaDescriptor[] = [{title: data?.title}];
  const image =
    data?.content?.images[0]?.small ??
    data?.left?.images[0]?.small ??
    data?.right?.images[0]?.small ??
    data?.bottom?.images[0]?.small;

  if (image) {
    result.push({
      property: 'og:image',
      content: image,
    });
  }
  return result;
});

export default function Page() {
  const data = useTypedLoaderData<typeof loader>();
  return <PageComponent {...data} />;
}
