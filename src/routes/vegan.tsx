import {createFileRoute, redirect} from '@tanstack/react-router';

// Short marketing URL that lands on the menu pre-filtered to vegan products.
//
// In production this route is never reached: the matching `routeRules` entry in
// vite.config.ts is emitted ahead of the `/__fallback` catch-all, so Vercel
// answers the 307 at the edge without invoking the function. This file exists so
// the URL still works under `vite dev` (which doesn't apply route rules) and so
// the destination stays type-checked — if `/speisekarte` or its `filter` search
// param is ever renamed, this breaks the build and flags the config as stale.
export const Route = createFileRoute('/vegan')({
  beforeLoad: () => {
    throw redirect({to: '/speisekarte', search: {filter: 'vegan'}});
  },
});
