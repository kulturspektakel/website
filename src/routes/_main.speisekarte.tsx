import {Flex, Heading, ListItem, ListRoot} from '@chakra-ui/react';
import ProductList from '../components/speisekarte/ProductList';
import DietFilterSelect from '../components/speisekarte/DietFilterSelect';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {and, asc, eq, exists, notExists} from 'drizzle-orm';
import {db} from '../server/db.server';
import {
  product,
  productAdditives,
  productList,
  productToProductAdditives,
} from '../server/db/schema';
import {seo} from '../utils/seo';

export type DietFilter = 'vegan' | 'glutenfrei';

// Translates the active filter into a condition on a list's products. `glutenfrei`
// keeps products that don't carry additive `A` (gluten), including products with no
// additives at all. Takes the products table it applies to, because a nested
// relation query refers to it under its own alias.
function productFilter(
  filter: DietFilter | undefined,
  p: Pick<typeof product, 'id' | 'diet'>,
) {
  switch (filter) {
    case 'vegan':
      return eq(p.diet, 'VEGAN');
    case 'glutenfrei':
      return notExists(
        db
          .select({a: productToProductAdditives.A})
          .from(productToProductAdditives)
          .where(
            and(
              eq(productToProductAdditives.A, p.id),
              eq(productToProductAdditives.B, 'A'),
            ),
          ),
      );
    default:
      return undefined;
  }
}

const loader = createServerFn()
  .validator((data: {filter?: DietFilter}) => data)
  .handler(async ({data}) => {
    const additives = await db
      .select({id: productAdditives.id, displayName: productAdditives.displayName})
      .from(productAdditives)
      .orderBy(asc(productAdditives.id));

    const rows = await db.query.productList.findMany({
      where: (l) =>
        and(
          eq(l.active, true),
          // Hide lists that have no matching product under the active filter.
          data.filter
            ? exists(
                db
                  .select({id: product.id})
                  .from(product)
                  .where(
                    and(
                      eq(product.productListId, l.id),
                      productFilter(data.filter, product),
                    ),
                  ),
              )
            : undefined,
        ),
      orderBy: asc(productList.name),
      columns: {id: true, name: true, emoji: true, description: true},
      with: {
        products: {
          where: (p) => productFilter(data.filter, p),
          columns: {id: true, name: true, price: true, requiresDeposit: true},
          with: {
            productToProductAdditives: {
              columns: {},
              with: {
                productAdditive: {columns: {id: true, displayName: true}},
              },
            },
          },
        },
      },
    });
    // The shape the page renders (Prisma's: `product`, `additives`).
    const lists = rows.map(({products, ...list}) => ({
      ...list,
      product: products.map(({productToProductAdditives: links, ...p}) => ({
        ...p,
        additives: links.map((link) => link.productAdditive),
      })),
    }));

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
