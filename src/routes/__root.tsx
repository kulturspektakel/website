import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width,initial-scale=1'},
    ],
  }),
  component: RootComponent,
});

// The noise area is the only English part of the site. Matching by route id
// rather than pathname so it can't drift from the layout route that owns the area.
//
// Nothing about colour is decided here. The area is dark, but that scope lives on
// the layout's own root (see crew.noise) rather than on <html>, and deliberately:
// Chakra portals menus, dialogs, popovers and the toaster to document.body, so a
// scope inside the layout is exactly what leaves those light. The dark page with
// ordinary light overlays over it is the wanted arrangement, not a compromise —
// which is why the area's dialogs no longer have to re-scope themselves back out.
const NOISE_ROUTE_ID = '/crew/noise';

function RootComponent() {
  // Created per request in `getRouter`, not at module scope, so SSR can't share
  // one visitor's query cache with the next.
  const {queryClient} = Route.useRouteContext();
  const english = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === NOISE_ROUTE_ID),
  });

  return (
    // `lang` is what a screen reader picks its pronunciation from, and German
    // vowels over English copy are unintelligible.
    <html lang={english ? 'en' : 'de'}>
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Outlet />
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
