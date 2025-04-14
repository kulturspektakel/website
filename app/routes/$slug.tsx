import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownText} from '../utils/markdownText';
import Page from '../components/Page';

export const Route = createFileRoute('/$slug')({
  component: PageRoute,
  loader: async ({params}) => await pageLoader({data: params.slug}),
});

const pageLoader = createServerFn()
  .validator((slug: string) => slug)
  .handler(async ({data: slug}) => {
    const data = await prismaClient.page.findUnique({
      where: {
        slug,
      },
      select: {
        title: true,
        content: true,
        left: true,
        right: true,
        bottom: true,
      },
    });

    if (!data) {
      throw notFound();
    }

    const {left, right, bottom, content, ...page} = data;

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
