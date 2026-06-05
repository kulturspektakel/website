import {createFileRoute} from '@tanstack/react-router';
import {handleCreateMembershipApplication} from '../server/tasks/create-membership-application';

export const Route = createFileRoute('/api/tasks/create-membership-application')(
  {
    server: {
      handlers: {
        POST: ({request}) => handleCreateMembershipApplication(request),
      },
    },
  },
);
