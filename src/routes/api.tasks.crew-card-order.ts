import {createFileRoute} from '@tanstack/react-router';
import {handleCrewCardOrder} from '../server/tasks/crew-card-order';

export const Route = createFileRoute('/api/tasks/crew-card-order')({
  server: {
    handlers: {
      POST: ({request}) => handleCrewCardOrder(request),
    },
  },
});
