import {gql} from '@apollo/client';
import {Heading, ListItem, UnorderedList} from '@chakra-ui/react';
import type {LoaderFunctionArgs} from '@remix-run/node';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import ProductList from '~/components/speisekarte/ProductList';
import type {SpeisekarteQuery} from '~/types/graphql';
import {SpeisekarteDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';
import mergeMeta from '~/utils/mergeMeta';

gql`
  query Speisekarte {
    productLists(activeOnly: true) {
      name
      emoji
      ...ProductListComponent
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<SpeisekarteQuery>({
    query: SpeisekarteDocument,
  });

  return typedjson(data);
}

export const meta = mergeMeta<typeof loader>(({data}) => [
  {
    title: 'Speisen & Getränke',
  },
]);

export default function Speisekarte() {
  const {productLists} = useTypedLoaderData<typeof loader>();

  return (
    <>
      <Heading mb="10" textAlign="center">
        Speisen & Getränke
      </Heading>
      <UnorderedList
        columnGap="10"
        m="0"
        sx={{columnCount: [1, 2]}}
        listStyleType="none"
      >
        {productLists.map((productList) => (
          <ListItem
            key={productList.name}
            sx={{breakInside: 'avoid-column'}}
            pb="10"
          >
            <Heading size="md" textAlign="center" mb="2">
              {productList.emoji} {productList.name}
            </Heading>
            <ProductList productList={productList} />
          </ListItem>
        ))}
      </UnorderedList>
    </>
  );
}
