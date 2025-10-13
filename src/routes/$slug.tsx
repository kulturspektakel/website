import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {imageIDsFromMarkdown, markdownText} from '../utils/markdownText';
import Page, {pageSelect} from '../components/Page';
import {directusImages} from '../utils/directusImage';
import {seo} from '../utils/seo';

export const Route = createFileRoute('/$slug')({
  component: PageRoute,
  loader: async ({params}) => {
    const data = await pageLoader({data: params.slug});
    if (!data) {
      throw notFound();
    }
    return data;
  },
  head: ({loaderData}) =>
    loaderData
      ? seo({
          title: loaderData.title,
          description: loaderData.content?.markdown,
        })
      : {},
});

export const pageLoader = createServerFn()
  .inputValidator((slug: string) => slug)
  .handler(async ({data: slug}) => {
    const data = await prismaClient.page.findUnique({
      where: {
        slug,
      },
      select: pageSelect,
    });

    if (!data) {
      return null;
    }

    const {left, right, bottom, content, ...page} = data;
    const imageMap = await directusImages(
      imageIDsFromMarkdown(left, right, bottom, content),
    );

    const [contentMd, leftMd, rightMd, bottomMd] = await Promise.all([
      content ? markdownText(content, imageMap) : undefined,
      left ? markdownText(left, imageMap) : undefined,
      right ? markdownText(right, imageMap) : undefined,
      bottom ? markdownText(bottom, imageMap) : undefined,
    ]);

    return {
      ...page,
      left: leftMd,
      right: rightMd,
      bottom: bottomMd,
      content: contentMd,
    };
  });

function PageRoute() {
  const page = Route.useLoaderData();
  return <Page {...page} />;
}
