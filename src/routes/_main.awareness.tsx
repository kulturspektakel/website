import {createFileRoute, notFound} from '@tanstack/react-router';
import {Stack} from '@chakra-ui/react';
import Page from '../components/Page';
import {seo} from '../utils/seo';
import {pageLoader} from '../server/pageLoader';
import {AwarenessBox} from '../components/awareness/AwarenessBox';

// Static route — takes precedence over `_main.$slug` for `/awareness`, so it
// renders the same DB-backed markdown page but with the awareness box on top.
export const Route = createFileRoute('/_main/awareness')({
  component: AwarenessRoute,
  loader: async () => {
    const data = await pageLoader({data: 'awareness'});
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

function AwarenessRoute() {
  const page = Route.useLoaderData();
  return (
    <Stack gap="6" w="100%">
      <AwarenessBox />
      <Page {...page} />
    </Stack>
  );
}
