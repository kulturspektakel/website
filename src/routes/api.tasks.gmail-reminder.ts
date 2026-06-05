import {createFileRoute} from '@tanstack/react-router';
import {handleGmailReminder} from '../server/tasks/gmail-reminder';

export const Route = createFileRoute('/api/tasks/gmail-reminder')({
  server: {
    handlers: {
      POST: ({request}) => handleGmailReminder(request),
    },
  },
});
