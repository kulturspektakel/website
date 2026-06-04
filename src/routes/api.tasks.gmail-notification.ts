import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleGmailNotification} from '../server/tasks/gmail-notification';

export const Route = createFileRoute('/api/tasks/gmail-notification')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-notification')],
    handlers: {
      POST: ({request}) => handleGmailNotification(request),
    },
  },
});
