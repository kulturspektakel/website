import {gql} from '@apollo/client';
import type {LoaderArgs, V2_MetaFunction} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import PageComponent from '~/components/Page';
import type {PageQuery} from '~/types/graphql';
import {PageDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import {mergeMeta} from '~/utils/mergeMeta';

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

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<PageQuery>({
    query: PageDocument,
    variables: {
      id: `Page:${args.params.slug}`,
    },
  });
  if (data.node?.__typename === 'Page') {
    return typedjson(data.node);
  }
  throw new Error('not found');
}

export const meta: V2_MetaFunction<typeof loader> = mergeMeta((args) => {
  return [{title: args.data.title}];
});

export default function Page() {
  const data = useTypedLoaderData<typeof loader>();
  return <PageComponent {...data} />;
}
