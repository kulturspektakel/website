import {createFileRoute, redirect} from '@tanstack/react-router';

// A project has no view of its own — it is either its map or its list. Every link
// still points here, so this is the one place that decides which one you land on,
// and the map wins whenever there is a map to show.
export const Route = createFileRoute('/crew/lautstaerke/projekt/$projectId/')({
  // Awaiting the parent match rather than loading the project again: the answer
  // is in the Maps key its loader already fetched. replace, so the back button
  // returns to wherever you came from instead of bouncing through here again.
  loader: async ({params, parentMatchPromise}) => {
    const {loaderData} = await parentMatchPromise;
    throw redirect({
      to: loaderData?.apiKey
        ? '/crew/lautstaerke/projekt/$projectId/karte'
        : '/crew/lautstaerke/projekt/$projectId/liste',
      params,
      replace: true,
    });
  },
});
