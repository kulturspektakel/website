import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleCreateNonceRequest} from '../server/routes/tasks.create-nonce-request';

export const Route = createFileRoute('/api/tasks/create-nonce-request')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('create-nonce-request')],
    handlers: {
      POST: ({request}) => handleCreateNonceRequest(request),
    },
  },
});
