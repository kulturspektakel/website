import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleNonceRequestInvalidate} from '../server/tasks/nonce-request-invalidate';

export const Route = createFileRoute('/api/tasks/nonce-request-invalidate')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nonce-request-invalidate')],
    handlers: {
      POST: ({request}) => handleNonceRequestInvalidate(request),
    },
  },
});
