import {createFileRoute, Outlet} from '@tanstack/react-router';
import {Container} from '@chakra-ui/react';
import {z} from 'zod';
import {prismaClient} from '../server/prismaClient.server';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {directusUsers} from '../server/directusUsers.server';
import {seo} from '../utils/seo';

export const listProductLists = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    const lists = await prismaClient.productList.findMany({
      orderBy: {name: 'asc'},
      select: {
        id: true,
        name: true,
        emoji: true,
        active: true,
        updatedAt: true,
        lastUpdatedBy: true,
      },
    });
    const users = await directusUsers(lists.map((l) => l.lastUpdatedBy));
    return lists.map((l) => {
      const u = l.lastUpdatedBy ? users[l.lastUpdatedBy] : undefined;
      const updatedByName = u
        ? [u.first_name, u.last_name].filter(Boolean).join(' ') || null
        : null;
      return {...l, updatedByName};
    });
  });

export const listAdditives = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    return prismaClient.productAdditives.findMany({
      orderBy: {displayName: 'asc'},
      select: {id: true, displayName: true},
    });
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
  .inputValidator(createProductListInput)
  .handler(async ({data}) => {
    return prismaClient.productList.create({
      data: {name: data.name, emoji: data.emoji},
      select: {id: true},
    });
  });

export const updateProductListInput = z.object({
  id: z.number().int(),
  name: z.string().trim().min(1, 'Name erforderlich').max(20),
  emoji,
  active: z.boolean(),
});

export const updateProductList = createServerFn()
  .middleware([crewAuth])
  .inputValidator(updateProductListInput)
  .handler(async ({data, context}) => {
    await prismaClient.productList.update({
      where: {id: data.id},
      data: {
        name: data.name,
        emoji: data.emoji,
        active: data.active,
        updatedAt: new Date(),
        lastUpdatedBy: context.user?.id ?? null,
      },
    });
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
