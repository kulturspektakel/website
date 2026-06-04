import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleGmailReminder} from '../server/tasks/gmail-reminder';

export const Route = createFileRoute('/api/tasks/gmail-reminder')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-reminder')],
    handlers: {
      POST: ({request}) => handleGmailReminder(request),
    },
  },
});
