import {createFileRoute} from '@tanstack/react-router';
import {handleCreateBandApplication} from '../server/tasks/create-band-application';

export const Route = createFileRoute('/api/tasks/create-band-application')({
  server: {
    handlers: {
      POST: ({request}) => handleCreateBandApplication(request),
    },
  },
});
