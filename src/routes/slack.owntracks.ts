import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleOwnTracksCommand} from '../server/routes/slack/owntracks';

export const Route = createFileRoute('/slack/owntracks')({
  server: {
    // Slack posts the slash command directly; intentionally no auth (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleOwnTracksCommand(request),
    },
  },
});
