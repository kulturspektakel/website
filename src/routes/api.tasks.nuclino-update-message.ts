import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleNuclinoUpdateMessage} from '../server/routes/tasks.nuclino-update-message';

export const Route = createFileRoute('/api/tasks/nuclino-update-message')({
  server: {
    middleware: [apiErrorBoundary, gcpAuth('nuclino-update-message')],
    handlers: {
      POST: () => handleNuclinoUpdateMessage(),
    },
  },
});
