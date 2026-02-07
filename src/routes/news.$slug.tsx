import Article from '../components/news/Article';
import {createFileRoute} from '@tanstack/react-router';
import {markdownToTxt} from 'markdown-to-txt';
import {seo} from '../utils/seo';
import {loader} from '../server/routes/news.$slug';

export const Route = createFileRoute('/news/$slug')({
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
