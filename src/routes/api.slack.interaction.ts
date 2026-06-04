import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleSlackInteraction} from '../server/slack/interaction';

export const Route = createFileRoute('/api/slack/interaction')({
  server: {
    // Slack posts interactivity payloads directly; no auth middleware (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleSlackInteraction(request),
    },
  },
});
