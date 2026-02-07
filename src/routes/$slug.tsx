import {createFileRoute, notFound} from '@tanstack/react-router';
import Page from '../components/Page';
import {seo} from '../utils/seo';
import {pageLoader} from '../server/routes/$slug';

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

function PageRoute() {
  const page = Route.useLoaderData();
  return <Page {...page} />;
}
