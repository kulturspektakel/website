import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleCreateBandApplication} from '../server/routes/tasks.create-band-application';

export const Route = createFileRoute('/api/tasks/create-band-application')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('create-band-application')],
    handlers: {
      POST: ({request}) => handleCreateBandApplication(request),
    },
  },
});
