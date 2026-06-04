import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleCreateBandApplication} from '../server/tasks/create-band-application';

export const Route = createFileRoute('/api/tasks/create-band-application')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('create-band-application')],
    handlers: {
      POST: ({request}) => handleCreateBandApplication(request),
    },
  },
});
