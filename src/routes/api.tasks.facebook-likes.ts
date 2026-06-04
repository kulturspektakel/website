import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleFacebookLikes} from '../server/tasks/facebook-likes';

export const Route = createFileRoute('/api/tasks/facebook-likes')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('facebook-likes')],
    handlers: {
      POST: ({request}) => handleFacebookLikes(request),
    },
  },
});
