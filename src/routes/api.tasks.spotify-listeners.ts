import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleSpotifyListeners} from '../server/routes/tasks.spotify-listeners';

export const Route = createFileRoute('/api/tasks/spotify-listeners')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('spotify-listeners')],
    handlers: {
      POST: ({request}) => handleSpotifyListeners(request),
    },
  },
});
