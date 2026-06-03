import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {gcpAuth} from '../utils/gcpAuth.server';
import {handleCreateMembershipApplication} from '../server/routes/tasks.create-membership-application';

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
