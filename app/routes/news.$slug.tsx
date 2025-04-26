import Article from '../components/news/Article';
import {createFileRoute, notFound} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../utils/prismaClient';
import {markdownText} from '../utils/markdownText';
import truncate from '../utils/truncate';
import {imageUrl} from '../utils/directusImage';
import {markdownToTxt} from 'markdown-to-txt';

export const Route = createFileRoute('/news/$slug')({
  component: News,
  loader: async ({params}) => await loader({data: params.slug}),
  head: ({loaderData}) => {
    const meta = [
      {title: loaderData.title},
      {
        name: 'description',
        content: truncate(markdownToTxt(loaderData.content.markdown), 150),
      },
    ];

    if (loaderData.content.images.length > 0) {
      meta.push({
        property: 'og:image',
        content: imageUrl(loaderData!.content.images[0].id, {width: 960}),
      });
    }

    return {
      meta,
    };
  },
});

const loader = createServerFn()
  .validator((slug: string) => slug)
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

export default function News() {
  const data = Route.useLoaderData();
  return <Article data={data} />;
}
