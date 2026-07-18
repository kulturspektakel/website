import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {
  handleNuclinoTokenCommand,
  handleNuclinoTokenRedirect,
} from '../server/slack/token';

export const Route = createFileRoute('/api/slack/token')({
  server: {
    // POST = Slack slash command (signature-verified), GET = the modal
    // button's redirect link (browser request, no Slack signature — passed
    // through by verifySlackSignature and gated by its own one-time nonce).
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleNuclinoTokenCommand(request),
      GET: ({request}) => handleNuclinoTokenRedirect(request),
    },
  },
});
