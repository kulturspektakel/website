import {createFileRoute} from '@tanstack/react-router';
import {handleInstagramFollower} from '../server/tasks/instagram-follower';

export const Route = createFileRoute('/api/tasks/instagram-follower')({
  server: {
    handlers: {
      POST: ({request}) => handleInstagramFollower(request),
    },
  },
});
