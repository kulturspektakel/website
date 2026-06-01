import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleDemo} from '../server/routes/tasks.demo';

export const Route = createFileRoute('/api/tasks/demo')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('demo')],
    handlers: {
      POST: ({request}) => handleDemo(request),
    },
  },
});
