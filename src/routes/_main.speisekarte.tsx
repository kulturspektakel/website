import {Heading, ListItem, ListRoot} from '@chakra-ui/react';
import ProductList from '../components/speisekarte/ProductList';
import FilterNotice from '../components/speisekarte/FilterNotice';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../server/prismaClient.server';
import type {Prisma} from '../generated/prisma/client';
import {seo} from '../utils/seo';

export type DietFilter = 'vegan' | 'glutenfrei';

// Translates the active filter into a Prisma `where` applied to each list's
// products. `glutenfrei` keeps products that don't carry additive `A` (gluten),
// including products with no additives at all.
function productWhereForFilter(
  filter: DietFilter | undefined,
): Prisma.ProductWhereInput | undefined {
  switch (filter) {
    case 'vegan':
      return {diet: 'VEGAN'};
    case 'glutenfrei':
      return {additives: {none: {id: 'A'}}};
    default:
      return undefined;
  }
}

const loader = createServerFn()
  .inputValidator((data: {filter?: DietFilter}) => data)
  .handler(async ({data}) => {
    const productWhere = productWhereForFilter(data.filter);

    const lists = await prismaClient.productList.findMany({
      where: {
        active: true,
        // Hide lists that have no matching product under the active filter.
        ...(productWhere && {product: {some: productWhere}}),
      },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        emoji: true,
        description: true,
        product: {
          where: productWhere,
          select: {
            id: true,
            name: true,
            price: true,
            requiresDeposit: true,
            additives: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
      },
    });

    return lists;
  });

export const Route = createFileRoute('/_main/speisekarte')({
  component: Speisekarte,
  validateSearch: (search: Record<string, unknown>): {filter?: DietFilter} => ({
    filter:
      search.filter === 'vegan' || search.filter === 'glutenfrei'
        ? search.filter
        : undefined,
  }),
  loaderDeps: ({search}) => ({filter: search.filter}),
  loader: async ({deps}) => await loader({data: {filter: deps.filter}}),
  head: () =>
    seo({
      title: 'Speisen & Getränke',
      description: 'Unser kulinarisches Angebot auf dem Kulturspektakel',
    }),
});

export default function Speisekarte() {
  const data = Route.useLoaderData();
  const {filter} = Route.useSearch();

  return (
    <>
      <Heading mb="10" textAlign="center" size="3xl">
        Speisen & Getränke
      </Heading>
      {filter && <FilterNotice filter={filter} />}
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
