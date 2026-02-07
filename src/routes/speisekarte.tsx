import {Heading, ListItem, ListRoot} from '@chakra-ui/react';
import ProductList from '../components/speisekarte/ProductList';
import {createFileRoute} from '@tanstack/react-router';
import {loader} from '../server/routes/speisekarte';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/speisekarte')({
  component: Speisekarte,
  loader: async () => await loader(),
  head: () =>
    seo({
      title: 'Speisen & Getränke',
      description: 'Unser kulinarisches Angebot auf dem Kulturspektakel',
    }),
});

export default function Speisekarte() {
  const data = Route.useLoaderData();

  return (
    <>
      <Heading mb="10" textAlign="center" size="3xl">
        Speisen & Getränke
      </Heading>
      <ListRoot
        display="block"
        columnGap="10"
        m="0"
        columnCount={[1, 2]}
        listStyleType="none"
      >
        {data.map((productList) => (
          <ListItem key={productList.name} breakInside="avoid-column" pb="10">
            <Heading size="md" textAlign="center" mb="2">
              {productList.emoji} {productList.name}
            </Heading>
            <ProductList productList={productList} />
          </ListItem>
        ))}
      </ListRoot>
    </>
  );
}
