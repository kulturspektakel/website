import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleOwnTracksCommand} from '../server/slack/owntracks';

export const Route = createFileRoute('/api/slack/owntracks')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleOwnTracksCommand(request),
    },
  },
});
