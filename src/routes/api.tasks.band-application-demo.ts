import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleBandApplicationDemo} from '../server/routes/tasks.band-application-demo';

export const Route = createFileRoute('/api/tasks/band-application-demo')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('band-application-demo')],
    handlers: {
      POST: ({request}) => handleBandApplicationDemo(request),
    },
  },
});
