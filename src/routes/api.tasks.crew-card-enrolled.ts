import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleCrewCardEnrolled} from '../server/routes/tasks.crew-card-enrolled';

export const Route = createFileRoute('/api/tasks/crew-card-enrolled')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('crew-card-enrolled')],
    handlers: {
      POST: ({request}) => handleCrewCardEnrolled(request),
    },
  },
});
