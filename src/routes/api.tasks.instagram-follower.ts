import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleInstagramFollower} from '../server/routes/tasks.instagram-follower';

export const Route = createFileRoute('/api/tasks/instagram-follower')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('instagram-follower')],
    handlers: {
      POST: ({request}) => handleInstagramFollower(request),
    },
  },
});
