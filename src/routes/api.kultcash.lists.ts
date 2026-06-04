import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';
import {handleLists} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/lists')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      GET: ({request}) => handleLists(request),
    },
  },
});
