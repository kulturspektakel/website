import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleSlackInteraction} from '../server/slack/interaction';

export const Route = createFileRoute('/api/slack/interaction')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleSlackInteraction(request),
    },
  },
});
