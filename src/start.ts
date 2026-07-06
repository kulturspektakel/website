import {createStart} from '@tanstack/react-start';
import {
  sentryGlobalFunctionMiddleware,
  sentryGlobalRequestMiddleware,
} from '@sentry/tanstackstart-react';

// Register Sentry's global middleware so unhandled request errors and
// `createServerFn` errors (loaders/actions) are captured everywhere. API and
// task/cron errors are additionally captured in `apiErrorBoundary`, which
// swallows them into HTTP responses before they reach this middleware.
export const startInstance = createStart(() => ({
  requestMiddleware: [sentryGlobalRequestMiddleware],
  functionMiddleware: [sentryGlobalFunctionMiddleware],
}));
