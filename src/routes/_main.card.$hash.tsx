import {createFileRoute, Outlet} from '@tanstack/react-router';
import {validateBadgeSearch} from '../utils/badgeConfig';

export const Route = createFileRoute('/_main/card/$hash')({
  component: Outlet,
  validateSearch: validateBadgeSearch,
});
