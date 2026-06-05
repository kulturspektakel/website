import {createFileRoute} from '@tanstack/react-router';
import {handleBandApplicationDistance} from '../server/tasks/band-application-distance';

export const Route = createFileRoute('/api/tasks/band-application-distance')({
  server: {
    handlers: {
      POST: ({request}) => handleBandApplicationDistance(request),
    },
  },
});
