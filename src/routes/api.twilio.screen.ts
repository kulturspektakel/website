import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifyTwilioSignature} from '../server/twilioAuth.server';
import {handleTwilioScreen} from '../server/twilioRouting';

export const Route = createFileRoute('/api/twilio/screen')({
  server: {
    middleware: [apiErrorBoundary, verifyTwilioSignature],
    handlers: {
      POST: ({request}) => handleTwilioScreen(request),
    },
  },
});
