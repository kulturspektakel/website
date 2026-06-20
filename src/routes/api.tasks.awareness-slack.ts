import {createFileRoute} from '@tanstack/react-router';
import {handleAwarenessSlack} from '../server/tasks/awareness-slack';

export const Route = createFileRoute('/api/tasks/awareness-slack')({
  server: {
    handlers: {
      POST: ({request}) => handleAwarenessSlack(request),
    },
  },
});
