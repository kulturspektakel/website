import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleGmailNotification} from '../server/routes/tasks.gmail-notification';

export const Route = createFileRoute('/api/tasks/gmail-notification')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-notification')],
    handlers: {
      POST: ({request}) => handleGmailNotification(request),
    },
  },
});
