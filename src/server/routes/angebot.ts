import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../../utils/prismaClient.server';
import {multiPage} from '../../utils/markdownText.server';

export const loader = createServerFn().handler(async () => {
  const pages = await multiPage([
    'speisen-getraenke',
    'sport',
    'kinderkult',
    'workshops',
  ] as const);

  const productLists = await prismaClient.productList.findMany({
    where: {
      active: true,
    },
    select: {
      id: true,
      name: true,
      emoji: true,
      description: true,
    },
  });

  return {
    ...pages,
    productLists,
  };
});
