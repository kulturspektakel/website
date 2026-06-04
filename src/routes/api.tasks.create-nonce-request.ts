import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleCreateNonceRequest} from '../server/tasks/create-nonce-request';

export const Route = createFileRoute('/api/tasks/create-nonce-request')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('create-nonce-request')],
    handlers: {
      POST: ({request}) => handleCreateNonceRequest(request),
    },
  },
});
