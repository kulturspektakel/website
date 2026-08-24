import {routeTree} from './routeTree.gen';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import {QueryClient} from '@tanstack/react-query';
import * as Sentry from '@sentry/tanstackstart-react';
import {NotFound} from './components/NotFound/NotFound';
import {Error} from './components/Error';
import {Pending} from './components/Pending';

export function getRouter() {
  // Per request, not per module. `getRouter` is memoized for the lifetime of a
  // single request by the Start handler, so a client created here is scoped to
  // that request. A module-level client would be shared across every SSR
  // request in the process, letting one visitor's cached queries be served to
  // the next — crew pages fetch user-specific data through this cache.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: {queryClient},
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
    // Hover or touch a link and its loaders start there, so by the time the click
    // lands the data is usually already in the match cache. This is what actually
    // removes the wait; everything below only decorates it.
    //
    // Safe to have on globally here: every write in the app lives in a mutation
    // server fn called from an event handler, not a loader. The two routes with
    // side effects in `beforeLoad` (`/nuclino-sso` mints a nonce, `/spenden/...`
    // is a one-shot receipt link) aren't linked from anywhere in the UI, so
    // intent-preloading can't reach them.
    defaultPreload: 'intent',
    // Loaders re-run on every visit at the default 0, so back/forward and tabbing
    // between two pages refetched both every time. Ten seconds is enough to make
    // that free without holding anything visibly stale — and `router.invalidate()`
    // after a mutation sets the `invalid` flag, which overrides this.
    defaultStaleTime: 10_000,
    defaultPendingComponent: Pending,
    // These two are additive, which is easy to miss: the loader awaits
    // `minPendingPromise` before it commits, and that timer only starts once the
    // pending view has rendered. So the floor is `defaultPendingMs +
    // defaultPendingMinMs`, and a 150/500 pair turned every 160ms navigation into
    // a 650ms one. 150/200 keeps the anti-flash guarantee without inflating the
    // merely-slightly-slow case, which is the common one.
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
  });

  // Browser-only: wire up Sentry route-change tracing.
  if (typeof document !== 'undefined') {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router),
    );
  }

  return router;
}
