import {Heading, ListItem, ListRoot} from '@chakra-ui/react';
import ProductList from '../components/speisekarte/ProductList';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';

export const Route = createFileRoute('/speisekarte')({
  component: Speisekarte,
  loader: async () => await loader(),
  head: () => ({
    meta: [
      {
        title: 'Speisen & Getränke',
      },
    ],
  }),
});

const loader = createServerFn().handler(async ({data: slug}) => {
  const data = await prismaClient.productList.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
      Product: {
        select: {
          id: true,
          name: true,
          price: true,
          requiresDeposit: true,
          ProductAdditives: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  return data;
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
