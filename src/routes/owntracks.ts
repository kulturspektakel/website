import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleOwnTracks} from '../server/routes/owntracks';

export const Route = createFileRoute('/owntracks')({
  server: {
    // Auth is HTTP Basic (ownTracksPassword) checked inside the handler.
    middleware: [apiErrorBoundary],
    handlers: {
      POST: ({request}) => handleOwnTracks(request),
    },
  },
});
