import ProgressBar from '@badrap/bar-of-progress';
import {routeTree} from './routeTree.gen';
import apolloClient from './utils/apolloClient';
import {routerWithApolloClient} from '@apollo/client-integration-tanstack-start';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import {NotFound} from './components/NotFound';
import {Error} from './components/Error';
import * as Sentry from '@sentry/tanstackstart-react';

let progress: ProgressBar;
export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    context: {} as any,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
  });

  router.subscribe('onBeforeNavigate', () => {
    if (typeof window !== 'undefined') {
      progress = new ProgressBar();
      progress.start();
    }
  });

  router.subscribe('onRendered', () => {
    if (typeof window !== 'undefined') {
      progress?.finish();
    }
  });

  return routerWithApolloClient(router, apolloClient);
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/tanstackstart-react/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  integrations: [],
  enabled: process.env.NODE_ENV === 'production',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
