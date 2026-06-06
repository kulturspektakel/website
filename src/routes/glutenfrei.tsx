import {createFileRoute, redirect} from '@tanstack/react-router';

// Short marketing URL that lands on the menu pre-filtered to gluten-free products.
export const Route = createFileRoute('/glutenfrei')({
  beforeLoad: () => {
    throw redirect({to: '/speisekarte', search: {filter: 'glutenfrei'}});
  },
});
