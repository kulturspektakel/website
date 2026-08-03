import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleBonbudeCommand} from '../server/slack/bonbude';

export const Route = createFileRoute('/api/slack/bonbude')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleBonbudeCommand(request),
    },
  },
});
