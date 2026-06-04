import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleNuclinoUpdateMessage} from '../server/tasks/nuclino-update-message';

export const Route = createFileRoute('/api/tasks/nuclino-update-message')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nuclino-update-message')],
    handlers: {
      POST: () => handleNuclinoUpdateMessage(),
    },
  },
});
