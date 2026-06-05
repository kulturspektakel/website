import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpTasksAuth} from '../server/gcpAuth.server';

/**
 * Layout route for `/api/tasks/*`. Its server middleware runs for every task
 * subroute (TanStack collects `server.middleware` from the whole matched route
 * chain), so each `api.tasks.*` handler is GCP-OIDC authenticated and wrapped
 * in the API error boundary without repeating the boilerplate — and a new task
 * route can't forget to opt in.
 */
export const Route = createFileRoute('/api/tasks')({
  server: {
    middleware: [apiErrorBoundary, gcpTasksAuth],
  },
});
