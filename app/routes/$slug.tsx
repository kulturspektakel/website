import {Center, Separator} from '@chakra-ui/react';
import React from 'react';
import Article from '../components/news/Article';
import LinkButton from '../components/LinkButton';
import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownText} from '../utils/markdownText';
import Page from '../components/Page';

export const Route = createFileRoute('/$slug')({
  component: PageRoute,
  loader: async ({params}) => await pageLoader({data: params.slug}),
});

const pageLoader = createServerFn()
  .validator((slug: string): string => String(slug))
  .handler(async (ctx) => {
    const {left, right, bottom, content, ...page} =
      await prismaClient.page.findUniqueOrThrow({
        where: {
          slug: ctx.data,
        },
        select: {
          title: true,
          slug: true,
          content: true,
          left: true,
          right: true,
          bottom: true,
        },
      });

    const [contentMd, leftMd, rightMd, bottomMd] = await Promise.all([
      content ? markdownText(content) : null,
      left ? markdownText(left) : null,
      right ? markdownText(right) : null,
      bottom ? markdownText(bottom) : null,
    ]);

    return {
      ...page,
      left: leftMd,
      right: rightMd,
      bottom: bottomMd,
      content: contentMd,
    };
  });

export function PageRoute() {
  const page = Route.useLoaderData();

  return <Page {...page} />;
}
