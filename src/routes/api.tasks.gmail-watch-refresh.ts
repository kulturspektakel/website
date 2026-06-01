import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleGmailWatchRefresh} from '../server/routes/tasks.gmail-watch-refresh';

export const Route = createFileRoute('/api/tasks/gmail-watch-refresh')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-watch-refresh')],
    handlers: {
      POST: () => handleGmailWatchRefresh(),
    },
  },
});
