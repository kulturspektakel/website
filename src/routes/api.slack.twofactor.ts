import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleTwoFactorCommand} from '../server/slack/twofactor';

export const Route = createFileRoute('/api/slack/twofactor')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleTwoFactorCommand(request),
    },
  },
});
