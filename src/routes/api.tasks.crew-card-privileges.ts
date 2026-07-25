import {createFileRoute} from '@tanstack/react-router';
import {handleCrewCardPrivileges} from '../server/tasks/crew-card-privileges';

export const Route = createFileRoute('/api/tasks/crew-card-privileges')({
  server: {
    handlers: {
      POST: () => handleCrewCardPrivileges(),
    },
  },
});
