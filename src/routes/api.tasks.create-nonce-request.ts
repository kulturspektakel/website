import {createFileRoute} from '@tanstack/react-router';
import {handleCreateNonceRequest} from '../server/tasks/create-nonce-request';

export const Route = createFileRoute('/api/tasks/create-nonce-request')({
  server: {
    handlers: {
      POST: ({request}) => handleCreateNonceRequest(request),
    },
  },
});
