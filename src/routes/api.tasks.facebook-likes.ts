import {createFileRoute} from '@tanstack/react-router';
import {handleFacebookLikes} from '../server/tasks/facebook-likes';

export const Route = createFileRoute('/api/tasks/facebook-likes')({
  server: {
    handlers: {
      POST: ({request}) => handleFacebookLikes(request),
    },
  },
});
