import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleNonceInvalidate} from '../server/tasks/nonce-invalidate';

export const Route = createFileRoute('/api/tasks/nonce-invalidate')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nonce-invalidate')],
    handlers: {
      POST: ({request}) => handleNonceInvalidate(request),
    },
  },
});
