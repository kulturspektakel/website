import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifySlackSignature} from '../server/slackAuth.server';
import {handleCrewCardCommand} from '../server/slack/crewCard';

export const Route = createFileRoute('/api/slack/crewcard')({
  server: {
    middleware: [apiErrorBoundary, verifySlackSignature],
    handlers: {
      POST: ({request}) => handleCrewCardCommand(request),
    },
  },
});
