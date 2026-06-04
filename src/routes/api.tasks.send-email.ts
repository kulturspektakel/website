import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleSendEmail} from '../server/tasks/send-email';

export const Route = createFileRoute('/api/tasks/send-email')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('send-email')],
    handlers: {
      POST: ({request}) => handleSendEmail(request),
    },
  },
});
