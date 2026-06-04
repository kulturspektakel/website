import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleCrewCardEnrolled} from '../server/tasks/crew-card-enrolled';

export const Route = createFileRoute('/api/tasks/crew-card-enrolled')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('crew-card-enrolled')],
    handlers: {
      POST: ({request}) => handleCrewCardEnrolled(request),
    },
  },
});
