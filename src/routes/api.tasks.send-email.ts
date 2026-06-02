import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleSendEmail} from '../server/routes/tasks.send-email';

export const Route = createFileRoute('/api/tasks/send-email')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('send-email')],
    handlers: {
      POST: ({request}) => handleSendEmail(request),
    },
  },
});
