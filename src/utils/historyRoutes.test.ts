import {describe, expect, it} from 'vitest';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import {stepsBackToOtherRoute, trackHistoryRoutes} from './historyRoutes';

// What the back arrow steps by: past every entry on the route it is on — another search,
// another device — to the last one on another route, and nowhere it can't vouch for.
async function setup(initial: string) {
  const root = createRootRoute();
  const index = createRoute({getParentRoute: () => root, path: '/'});
  const device = createRoute({
    getParentRoute: () => root,
    path: '/device/$device',
  });
  const project = createRoute({
    getParentRoute: () => root,
    path: '/project/$projectId',
  });
  const router = createRouter({
    routeTree: root.addChildren([index, device, project]),
    history: createMemoryHistory({initialEntries: [initial]}),
  });
  await router.load();
  trackHistoryRoutes(router);
  return router;
}

// Straight onto the history, as a link or the browser would put it there, then loaded — and
// resolved, which in the app the router's React side announces and nothing does here.
async function go(router: Awaited<ReturnType<typeof setup>>, href: string) {
  router.history.push(href);
  await router.load();
  router.emit({type: 'onResolved'} as never);
}

describe('stepsBackToOtherRoute', () => {
  it('steps over other devices on the same route', async () => {
    const router = await setup('/');
    await go(router, '/device/a');
    await go(router, '/device/b');
    await go(router, '/device/c');
    expect(stepsBackToOtherRoute(router)).toBe(-3);
  });

  it('steps over entries that differ only in their search', async () => {
    const router = await setup('/');
    await go(router, '/project/p');
    await go(router, '/project/p?from=1');
    expect(stepsBackToOtherRoute(router)).toBe(-2);
  });

  it('counts another route as a step of its own', async () => {
    const router = await setup('/');
    await go(router, '/device/a');
    await go(router, '/project/p');
    expect(stepsBackToOtherRoute(router)).toBe(-1);
  });

  it('knows nothing where it has nothing behind it', async () => {
    const router = await setup('/device/a');
    await go(router, '/device/b');
    expect(stepsBackToOtherRoute(router)).toBeNull();
  });
});
