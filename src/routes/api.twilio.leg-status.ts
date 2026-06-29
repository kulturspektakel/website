import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {verifyTwilioSignature} from '../server/twilioAuth.server';
import {handleTwilioLegStatus} from '../server/twilioRouting';

export const Route = createFileRoute('/api/twilio/leg-status')({
  server: {
    middleware: [apiErrorBoundary, verifyTwilioSignature],
    handlers: {
      POST: ({request, context}) =>
        handleTwilioLegStatus(context.twilioParams, request),
    },
  },
});
