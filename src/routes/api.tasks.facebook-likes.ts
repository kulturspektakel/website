import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleFacebookLikes} from '../server/routes/tasks.facebook-likes';

export const Route = createFileRoute('/api/tasks/facebook-likes')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('facebook-likes')],
    handlers: {
      POST: ({request}) => handleFacebookLikes(request),
    },
  },
});
