import {routeTree} from './routeTree.gen';
import apolloClient from './utils/apolloClient';
import {routerWithApolloClient} from '@apollo/client-integration-tanstack-start';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    context: {} as any,
  });

  return routerWithApolloClient(router, apolloClient);
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
