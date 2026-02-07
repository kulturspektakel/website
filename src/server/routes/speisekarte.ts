import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';

export const loader = createServerFn().handler(async () => {
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
      product: {
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

  return data;
});
