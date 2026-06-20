import {createFileRoute} from '@tanstack/react-router';
import {handleAwarenessCall} from '../server/tasks/awareness-call';

export const Route = createFileRoute('/api/tasks/awareness-call')({
  server: {
    handlers: {
      POST: ({request}) => handleAwarenessCall(request),
    },
  },
});
