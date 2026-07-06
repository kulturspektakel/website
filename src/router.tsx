import {routeTree} from './routeTree.gen';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import * as Sentry from '@sentry/tanstackstart-react';
import {NotFound} from './components/NotFound/NotFound';
import {Error} from './components/Error';

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
    defaultPendingMinMs: 0,
  });

  // Browser-only: wire up Sentry route-change tracing.
  if (typeof document !== 'undefined') {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router),
    );
  }

  return router;
}
