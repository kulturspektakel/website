import {gql} from '@apollo/client';
import {
  Accordion,
  Box,
  Heading,
  Spinner,
  useBreakpointValue,
} from '@chakra-ui/react';
import type {LoaderArgs} from '@remix-run/node';
import {useEffect, useMemo, useState} from 'react';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import ProductList from '~/components/speisekarte/ProductList';
import type {SpeisekarteQuery} from '~/types/graphql';
import {SpeisekarteDocument} from '~/types/graphql';
import apolloClient from '~/utils/apolloClient';

gql`
  query Speisekarte {
    productLists(activeOnly: true) {
      ...ProductListComponent
    }
  }
`;

export async function loader(args: LoaderArgs) {
  const {data} = await apolloClient.query<SpeisekarteQuery>({
    query: SpeisekarteDocument,
  });

  return typedjson(data);
}

export default function Speisekarte() {
  const {productLists} = useTypedLoaderData<typeof loader>();
  const none = useMemo<number[]>(() => [], []);
  const all = useMemo(
    () => productLists.map((_, i) => i),
    // hook is only depending on length of productLists
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [productLists.length],
  );
  const indices = useBreakpointValue({base: none, lg: all});
  const [openIndices, setOpenIndices] = useState<number[] | number | undefined>(
    indices,
  );

  useEffect(() => {
    setOpenIndices(indices);
  }, [indices]);

  if (!productLists || productLists.length < 1) {
    return <Spinner />;
  }

  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      <Heading>Speisen & Getränke</Heading>
      <Accordion
        index={openIndices}
        allowMultiple
        mt="5"
        onChange={setOpenIndices}
      >
        {productLists.map((productList) => (
          <ProductList productList={productList} key={productList.name} />
        ))}
      </Accordion>
    </Box>
  );
}
