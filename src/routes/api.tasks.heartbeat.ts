import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleHeartbeat} from '../server/routes/tasks';

export const Route = createFileRoute('/api/tasks/heartbeat')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('heartbeat')],
    handlers: {
      POST: () => handleHeartbeat(),
    },
  },
});
