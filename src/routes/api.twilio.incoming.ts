import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifyTwilioSignature} from '../server/twilioAuth.server';
import {handleTwilioIncoming} from '../server/twilioRouting';

export const Route = createFileRoute('/api/twilio/incoming')({
  server: {
    middleware: [apiErrorBoundary, verifyTwilioSignature],
    handlers: {
      POST: ({context}) => handleTwilioIncoming(context.twilioParams),
    },
  },
});
