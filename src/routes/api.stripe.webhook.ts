import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleStripeWebhook} from '../server/stripe';

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    // No gcpAuth/deviceAuth: the handler verifies the Stripe signature.
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleStripeWebhook(request),
    },
  },
});
