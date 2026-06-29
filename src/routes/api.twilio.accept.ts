import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifyTwilioSignature} from '../server/twilioAuth.server';
import {handleTwilioAccept} from '../server/twilioRouting';

export const Route = createFileRoute('/api/twilio/accept')({
  server: {
    middleware: [apiErrorBoundary, verifyTwilioSignature],
    handlers: {
      POST: ({request, context}) =>
        handleTwilioAccept(context.twilioParams, request),
    },
  },
});
