import {Flex, Heading, ListItem, ListRoot} from '@chakra-ui/react';
import ProductList from '../components/speisekarte/ProductList';
import DietFilterSelect from '../components/speisekarte/DietFilterSelect';
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

    const additives = await prismaClient.productAdditives.findMany({
      orderBy: {id: 'asc'},
      select: {
        id: true,
        displayName: true,
      },
    });

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

    return {lists, additives};
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
  const {lists, additives} = Route.useLoaderData();
  const {filter} = Route.useSearch();

  return (
    <>
      <Flex
        mb="10"
        gap="4"
        direction={{base: 'column', md: 'row'}}
        align={{base: 'stretch', md: 'center'}}
        justify="space-between"
      >
        <Heading size="3xl">Speisen & Getränke</Heading>
        <DietFilterSelect filter={filter} />
      </Flex>
      <ListRoot
        display="block"
        columnGap="10"
        m="0"
        columnCount={[1, 2]}
        listStyleType="none"
      >
        {lists.map((productList) => (
          <ListItem key={productList.name} breakInside="avoid-column" pb="10">
            <Heading size="md" textAlign="center" mb="2">
              {productList.emoji} {productList.name}
            </Heading>
            <ProductList productList={productList} />
          </ListItem>
        ))}
      </ListRoot>
      {additives.length > 0 && (
        <>
          <Heading size="md" mt="10" mb="2">
            Zusatzstoffe & Allergene
          </Heading>
          <ListRoot
            display="block"
            columnGap="10"
            m="0"
            columnCount={[1, 2]}
            listStyleType="none"
            fontSize="sm"
          >
            {additives.map((additive) => (
              <ListItem key={additive.id} breakInside="avoid-column">
                {additive.id}) {additive.displayName}
              </ListItem>
            ))}
          </ListRoot>
        </>
      )}
    </>
  );
}
