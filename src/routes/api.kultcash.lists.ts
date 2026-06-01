import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {deviceAuth} from '../utils/apiAuth.server';
import {handleLists} from '../server/routes/kultcash';

export const Route = createFileRoute('/api/kultcash/lists')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      GET: ({request}) => handleLists(request),
    },
  },
});
