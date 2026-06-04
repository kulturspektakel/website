import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleTwoFactorCommand} from '../server/routes/slack/twofactor';

export const Route = createFileRoute('/slack/twofactor')({
  server: {
    // Slack posts the slash command directly; no auth middleware (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleTwoFactorCommand(request),
    },
  },
});
