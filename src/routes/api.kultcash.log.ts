import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';
import {handleLog} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/log')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      POST: ({request}) => handleLog(request),
    },
  },
});
