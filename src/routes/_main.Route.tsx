import {createFileRoute, Outlet} from '@tanstack/react-router';
import {badgeConfig} from '../utils/badgeConfig';

export const Route = createFileRoute('/_main/Route')({
  component: Outlet,
  validateSearch: (search: {badge?: string}) => {
    if (search.badge && search.badge in badgeConfig) {
      return search as {badge: keyof typeof badgeConfig};
    }
  },
});
