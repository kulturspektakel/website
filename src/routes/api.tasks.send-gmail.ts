import {createFileRoute} from '@tanstack/react-router';
import {handleSendGmail} from '../server/tasks/send-gmail';

export const Route = createFileRoute('/api/tasks/send-gmail')({
  server: {
    handlers: {
      POST: ({request}) => handleSendGmail(request),
    },
  },
});
