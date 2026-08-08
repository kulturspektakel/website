import {
  Outlet,
  HeadContent,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {charSet: 'utf-8'},
      {name: 'viewport', content: 'width=device-width,initial-scale=1'},
    ],
  }),
  component: RootComponent,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
    },
  },
});

// Lautstärke is the one always-dark area. The scope has to sit on <html> rather
// than on a wrapper inside the layout: Chakra portals menus, dialogs and the
// toaster to document.body, so anything scoped further down leaves them light.
// `color-scheme` comes along for the native UI a class can't reach — scrollbars,
// and the <select> the header's view switch falls back to on phones.
//
// The area's dialogs are the one deliberate exception: they pass
// appearance="light" to DialogContent, which re-scopes the tokens on a wrapper of
// its own (see the snippet). A sheet of paper over a dark app, and they are the
// surfaces full of form fields. Menus, popovers and the toaster all still follow
// the scope set here.
//
// Matching by route id rather than pathname so it can't drift from the layout
// route that owns the area.
const DARK_ROUTE_ID = '/crew/lautstaerke';

function RootComponent() {
  const dark = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId === DARK_ROUTE_ID),
  });

  return (
    <html
      lang="de"
      className={dark ? 'dark' : undefined}
      style={dark ? {colorScheme: 'dark'} : undefined}
    >
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
