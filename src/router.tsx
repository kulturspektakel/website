import {routeTree} from './routeTree.gen';
import {createRouter as createTanStackRouter} from '@tanstack/react-router';
import {NotFound} from './components/NotFound/NotFound';
import {Error} from './components/Error';

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: Error,
    defaultPendingMinMs: 0,
  });
}
