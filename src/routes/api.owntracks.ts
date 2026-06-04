import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleOwnTracks} from '../server/owntracks';

export const Route = createFileRoute('/api/owntracks')({
  server: {
    // Auth is HTTP Basic (ownTracksPassword) checked inside the handler.
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleOwnTracks(request),
    },
  },
});
