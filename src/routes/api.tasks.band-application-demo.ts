import {createFileRoute} from '@tanstack/react-router';
import {handleBandApplicationDemo} from '../server/tasks/band-application-demo';

export const Route = createFileRoute('/api/tasks/band-application-demo')({
  server: {
    handlers: {
      POST: ({request}) => handleBandApplicationDemo(request),
    },
  },
});
