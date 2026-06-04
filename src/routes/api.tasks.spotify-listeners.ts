import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleSpotifyListeners} from '../server/tasks/spotify-listeners';

export const Route = createFileRoute('/api/tasks/spotify-listeners')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('spotify-listeners')],
    handlers: {
      POST: ({request}) => handleSpotifyListeners(request),
    },
  },
});
