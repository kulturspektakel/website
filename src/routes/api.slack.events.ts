import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleSlackEvents} from '../server/slack/events';

export const Route = createFileRoute('/api/slack/events')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleSlackEvents(request),
    },
  },
});
