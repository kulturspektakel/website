import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleOwnTracksCommand} from '../server/slack/owntracks';

export const Route = createFileRoute('/api/slack/owntracks')({
  server: {
    // Slack posts the slash command directly; intentionally no auth (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleOwnTracksCommand(request),
    },
  },
});
