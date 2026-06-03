import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleBandApplicationDistance} from '../server/routes/tasks.band-application-distance';

export const Route = createFileRoute('/api/tasks/band-application-distance')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('band-application-distance')],
    handlers: {
      POST: ({request}) => handleBandApplicationDistance(request),
    },
  },
});
