import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {gcpAuth} from '../server/gcpAuth.server';
import {handleCreateMembershipApplication} from '../server/tasks/create-membership-application';

export const Route = createFileRoute('/api/tasks/create-membership-application')(
  {
    server: {
      middleware: [
        apiErrorBoundary,
        gcpAuth('create-membership-application'),
      ],
      handlers: {
        POST: ({request}) => handleCreateMembershipApplication(request),
      },
    },
  },
);
