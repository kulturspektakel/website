import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleBandApplicationDemo} from '../server/tasks/band-application-demo';

export const Route = createFileRoute('/api/tasks/band-application-demo')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('band-application-demo')],
    handlers: {
      POST: ({request}) => handleBandApplicationDemo(request),
    },
  },
});
