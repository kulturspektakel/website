import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleSlackInteraction} from '../server/routes/slack/interaction';

export const Route = createFileRoute('/api/slack/interaction')({
  server: {
    // Slack posts interactivity payloads directly; no auth middleware (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleSlackInteraction(request),
    },
  },
});
