import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {deviceAuth} from '../utils/apiAuth.server';
import {handleLog} from '../server/routes/kultcash';

export const Route = createFileRoute('/api/kultcash/log')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      POST: ({request}) => handleLog(request),
    },
  },
});
