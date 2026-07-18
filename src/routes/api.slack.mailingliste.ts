import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleMailingListCommand} from '../server/slack/mailingList';

export const Route = createFileRoute('/api/slack/mailingliste')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleMailingListCommand(request),
    },
  },
});
