import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleMailingListCommand} from '../server/routes/slack/mailingList';

export const Route = createFileRoute('/slack/mailingliste')({
  server: {
    // Slack posts the slash command directly; intentionally no auth (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleMailingListCommand(request),
    },
  },
});
