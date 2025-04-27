import ProgressBar from '@badrap/bar-of-progress';
import {routeTree} from './routeTree.gen';
import apolloClient from './utils/apolloClient';
import {routerWithApolloClient} from '@apollo/client-integration-tanstack-start';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';

let progress: ProgressBar;
export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    context: {} as any,
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

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
