import {createFileRoute} from '@tanstack/react-router';
import {handleCrewCardEnrolled} from '../server/tasks/crew-card-enrolled';

export const Route = createFileRoute('/api/tasks/crew-card-enrolled')({
  server: {
    handlers: {
      POST: ({request}) => handleCrewCardEnrolled(request),
    },
  },
});
