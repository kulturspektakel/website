import {createFileRoute, redirect} from '@tanstack/react-router';

// Short marketing URL that lands on the menu pre-filtered to vegan products.
export const Route = createFileRoute('/vegan')({
  beforeLoad: () => {
    throw redirect({to: '/speisekarte', search: {filter: 'vegan'}});
  },
});
