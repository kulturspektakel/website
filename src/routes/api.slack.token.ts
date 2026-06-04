import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {
  handleNuclinoTokenCommand,
  handleNuclinoTokenRedirect,
} from '../server/routes/slack/token';

export const Route = createFileRoute('/api/slack/token')({
  server: {
    // POST = Slack slash command, GET = the modal button's redirect link.
    // No auth middleware (matches legacy); the GET is gated by a one-time nonce.
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleNuclinoTokenCommand(request),
      GET: ({request}) => handleNuclinoTokenRedirect(request),
    },
  },
});
