import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleBadgeAwarded} from '../server/tasks/badge-awarded';

export const Route = createFileRoute('/api/tasks/badge-awarded')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('badge-awarded')],
    handlers: {
      POST: ({request}) => handleBadgeAwarded(request),
    },
  },
});
