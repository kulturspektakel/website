import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleNonceRequestInvalidate} from '../server/routes/tasks';

export const Route = createFileRoute('/api/tasks/nonce-request-invalidate')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nonce-request-invalidate')],
    handlers: {
      POST: ({request}) => handleNonceRequestInvalidate(request),
    },
  },
});
