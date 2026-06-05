import {createFileRoute} from '@tanstack/react-router';
import {handleNonceInvalidate} from '../server/tasks/nonce-invalidate';

export const Route = createFileRoute('/api/tasks/nonce-invalidate')({
  server: {
    handlers: {
      POST: ({request}) => handleNonceInvalidate(request),
    },
  },
});
