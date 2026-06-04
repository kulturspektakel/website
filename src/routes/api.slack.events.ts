import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleSlackEvents} from '../server/slack/events';

export const Route = createFileRoute('/api/slack/events')({
  server: {
    // Slack posts events directly; intentionally no auth/signature check (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleSlackEvents(request),
    },
  },
});
