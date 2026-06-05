import {createFileRoute} from '@tanstack/react-router';
import {handleSpotifyListeners} from '../server/tasks/spotify-listeners';

export const Route = createFileRoute('/api/tasks/spotify-listeners')({
  server: {
    handlers: {
      POST: ({request}) => handleSpotifyListeners(request),
    },
  },
});
