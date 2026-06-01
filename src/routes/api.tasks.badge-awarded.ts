import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleBadgeAwarded} from '../server/routes/tasks.badge-awarded';

export const Route = createFileRoute('/api/tasks/badge-awarded')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('badge-awarded')],
    handlers: {
      POST: ({request}) => handleBadgeAwarded(request),
    },
  },
});
