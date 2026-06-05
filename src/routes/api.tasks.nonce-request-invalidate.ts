import {createFileRoute} from '@tanstack/react-router';
import {handleNonceRequestInvalidate} from '../server/tasks/nonce-request-invalidate';

export const Route = createFileRoute('/api/tasks/nonce-request-invalidate')({
  server: {
    handlers: {
      POST: ({request}) => handleNonceRequestInvalidate(request),
    },
  },
});
