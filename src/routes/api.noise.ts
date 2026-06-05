import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';

/**
 * Layout route for `/api/noise/*`. Its server middleware runs for every
 * subroute, so each noise handler is device-token authenticated (registering
 * the device as a `NOISE_MONITOR` via `touchDevice`) and wrapped in the API
 * error boundary without per-route boilerplate.
 */
export const Route = createFileRoute('/api/noise')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth('NOISE_MONITOR')],
  },
});
