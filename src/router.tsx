import {routeTree} from './routeTree.gen';
import apolloClient from './utils/apolloClient';
import {routerWithApolloClient} from '@apollo/client-integration-tanstack-start';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import {NotFound} from './components/NotFound/NotFound';
import {Error} from './components/Error';

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    context: {} as any,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
    defaultPendingMinMs: 0,
  });

  return routerWithApolloClient(router, apolloClient);
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
