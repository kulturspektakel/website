import {createFileRoute, Outlet} from '@tanstack/react-router';
import {badgeConfig} from '../utils/badgeConfig';
import {decodePayload} from '../utils/cardUtils';

export const Route = createFileRoute('/Route')({
  component: Outlet,
  validateSearch: (search: {badge?: string}) => {
    if (search.badge && search.badge in badgeConfig) {
      return search as {badge: keyof typeof badgeConfig};
    }
  },
  beforeLoad: ({params}) => {
    decodePayload(params);
  },
});
