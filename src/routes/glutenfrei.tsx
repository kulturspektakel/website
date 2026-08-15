import {createFileRoute, redirect} from '@tanstack/react-router';

// Short marketing URL that lands on the menu pre-filtered to gluten-free
// products. See vegan.tsx — production answers this at the edge via the
// `routeRules` entry in vite.config.ts; this file covers `vite dev` and keeps
// the destination type-checked.
export const Route = createFileRoute('/glutenfrei')({
  beforeLoad: () => {
    throw redirect({to: '/speisekarte', search: {filter: 'glutenfrei'}});
  },
});
