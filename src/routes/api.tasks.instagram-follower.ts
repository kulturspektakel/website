import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleInstagramFollower} from '../server/tasks/instagram-follower';

export const Route = createFileRoute('/api/tasks/instagram-follower')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('instagram-follower')],
    handlers: {
      POST: ({request}) => handleInstagramFollower(request),
    },
  },
});
