import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleTriggerDemo} from '../server/routes/tasks.trigger-demo';

export const Route = createFileRoute('/api/tasks/trigger-demo')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleTriggerDemo(request),
    },
  },
});
