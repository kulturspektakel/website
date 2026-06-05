import {createFileRoute} from '@tanstack/react-router';
import {handleGmailWatchRefresh} from '../server/tasks/gmail-watch-refresh';

export const Route = createFileRoute('/api/tasks/gmail-watch-refresh')({
  server: {
    handlers: {
      POST: () => handleGmailWatchRefresh(),
    },
  },
});
