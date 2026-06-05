import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';

/**
 * Layout route for `/api/kultcash/*`. Its server middleware runs for every
 * subroute, so each KultCash handler is device-token authenticated (and the
 * terminal registered via `touchDevice`) and wrapped in the API error boundary
 * without per-route boilerplate — a new route can't forget to opt in.
 */
export const Route = createFileRoute('/api/kultcash')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
  },
});
