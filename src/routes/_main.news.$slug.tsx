import Article from '../components/news/Article';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {markdownToTxt} from 'markdown-to-txt';
import {seo} from '../utils/seo';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../server/prismaClient.server';
import {markdownText} from '../server/markdownText.server';

const loader = createServerFn()
  .inputValidator((slug: string) => slug)
  .handler(async ({data: slug}) => {
    const data = await prismaClient.news.findUnique({
      where: {
        slug,
      },
      select: {
        title: true,
        content: true,
        slug: true,
        createdAt: true,
      },
    });

    if (!data) {
      throw notFound();
    }

    return {
      ...data,
      content: await markdownText(data.content),
    };
  });

export const Route = createFileRoute('/_main/news/$slug')({
  component: News,
  loader: async ({params}) => await loader({data: params.slug}),
  head: ({loaderData}) =>
    loaderData
      ? seo({
          imageId: loaderData?.content.images[0]?.id,
          description: markdownToTxt(loaderData.content.markdown),
          title: loaderData.title,
        })
      : {},
});

export default function News() {
  const data = Route.useLoaderData();
  return <Article data={data} />;
}
