import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleGmailReminder} from '../server/routes/tasks.gmail-reminder';

export const Route = createFileRoute('/api/tasks/gmail-reminder')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-reminder')],
    handlers: {
      POST: ({request}) => handleGmailReminder(request),
    },
  },
});
