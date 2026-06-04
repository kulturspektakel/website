import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleBandApplicationDistance} from '../server/tasks/band-application-distance';

export const Route = createFileRoute('/api/tasks/band-application-distance')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('band-application-distance')],
    handlers: {
      POST: ({request}) => handleBandApplicationDistance(request),
    },
  },
});
