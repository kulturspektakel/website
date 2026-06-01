import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleNonceInvalidate} from '../server/routes/tasks';

export const Route = createFileRoute('/api/tasks/nonce-invalidate')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nonce-invalidate')],
    handlers: {
      POST: ({request}) => handleNonceInvalidate(request),
    },
  },
});
