import {createFileRoute} from '@tanstack/react-router';
import {handleNuclinoUpdateMessage} from '../server/tasks/nuclino-update-message';

export const Route = createFileRoute('/api/tasks/nuclino-update-message')({
  server: {
    handlers: {
      POST: () => handleNuclinoUpdateMessage(),
    },
  },
});
