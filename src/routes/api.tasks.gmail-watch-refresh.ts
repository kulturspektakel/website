import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleGmailWatchRefresh} from '../server/tasks/gmail-watch-refresh';

export const Route = createFileRoute('/api/tasks/gmail-watch-refresh')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('gmail-watch-refresh')],
    handlers: {
      POST: () => handleGmailWatchRefresh(),
    },
  },
});
