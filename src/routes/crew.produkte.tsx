import {createFileRoute, Outlet} from '@tanstack/react-router';
import {Container} from '@chakra-ui/react';
import {z} from 'zod';
import {asc, eq} from 'drizzle-orm';
import {db} from '../server/db.server';
import {productAdditives, productList} from '../server/db/schema';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {seo} from '../utils/seo';

export const listProductLists = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    const lists = await db.query.productList.findMany({
      orderBy: asc(productList.name),
      columns: {
        id: true,
        name: true,
        emoji: true,
        active: true,
        updatedAt: true,
      },
      // `viewer` is whoever last updated the list.
      with: {viewer: {columns: {displayName: true}}},
    });
    return lists.map(({viewer, ...l}) => ({
      ...l,
      updatedByName: viewer?.displayName ?? null,
    }));
  });

export const listAdditives = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    return db
      .select({
        id: productAdditives.id,
        displayName: productAdditives.displayName,
      })
      .from(productAdditives)
      .orderBy(asc(productAdditives.displayName));
  });

const emoji = z
  .string()
  .trim()
  .max(8)
  .optional()
  .transform((v) => (v ? v : null));

export const createProductListInput = z.object({
  name: z.string().trim().min(1, 'Name erforderlich').max(20),
  emoji,
});

export const createProductList = createServerFn()
  .middleware([crewAuth])
  .validator(createProductListInput)
  .handler(async ({data}) => {
    const [created] = await db
      .insert(productList)
      .values({name: data.name, emoji: data.emoji})
      .returning({id: productList.id});
    return created;
  });

export const updateProductListInput = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1, 'Name erforderlich').max(20),
  emoji,
  active: z.boolean(),
});

export const updateProductList = createServerFn()
  .middleware([crewAuth])
  .validator(updateProductListInput)
  .handler(async ({data, context}) => {
    const updated = await db
      .update(productList)
      .set({
        name: data.name,
        emoji: data.emoji,
        active: data.active,
        updatedAt: new Date(),
        lastUpdatedBy: context.viewer?.id ?? null,
      })
      .where(eq(productList.id, data.id))
      .returning({id: productList.id});
    if (updated.length === 0) {
      throw new Error(`ProductList ${data.id} not found`);
    }
  });

export const Route = createFileRoute('/crew/produkte')({
  component: ProdukteLayout,
  head: () => seo({title: 'Produkte'}),
});

function ProdukteLayout() {
  return (
    <Container maxW="2xl" py="6">
      <Outlet />
    </Container>
  );
}
