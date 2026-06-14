import {createFileRoute} from '@tanstack/react-router';
import {handleSpotifyImage} from '../server/tasks/spotify-image';

export const Route = createFileRoute('/api/tasks/spotify-image')({
  server: {
    handlers: {
      POST: ({request}) => handleSpotifyImage(request),
    },
  },
});
