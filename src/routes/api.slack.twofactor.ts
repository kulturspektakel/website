import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleTwoFactorCommand} from '../server/slack/twofactor';

export const Route = createFileRoute('/api/slack/twofactor')({
  server: {
    // Slack posts the slash command directly; no auth middleware (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleTwoFactorCommand(request),
    },
  },
});
