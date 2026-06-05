import {createFileRoute} from '@tanstack/react-router';
import {handleGmailNotification} from '../server/tasks/gmail-notification';

export const Route = createFileRoute('/api/tasks/gmail-notification')({
  server: {
    handlers: {
      POST: ({request}) => handleGmailNotification(request),
    },
  },
});
