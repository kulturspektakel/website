import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleMailingListCommand} from '../server/slack/mailingList';

export const Route = createFileRoute('/api/slack/mailingliste')({
  server: {
    // Slack posts the slash command directly; intentionally no auth (matches legacy).
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleMailingListCommand(request),
    },
  },
});
