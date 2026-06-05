import {createFileRoute} from '@tanstack/react-router';
import {handleSendEmail} from '../server/tasks/send-email';

export const Route = createFileRoute('/api/tasks/send-email')({
  server: {
    handlers: {
      POST: ({request}) => handleSendEmail(request),
    },
  },
});
