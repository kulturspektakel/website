import {createFileRoute} from '@tanstack/react-router';
import {handleBadgeAwarded} from '../server/tasks/badge-awarded';

export const Route = createFileRoute('/api/tasks/badge-awarded')({
  server: {
    handlers: {
      POST: ({request}) => handleBadgeAwarded(request),
    },
  },
});
