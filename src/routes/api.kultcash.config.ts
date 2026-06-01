import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {deviceAuth} from '../utils/apiAuth.server';
import {handleConfig} from '../server/routes/kultcash';

export const Route = createFileRoute('/api/kultcash/config')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      GET: ({context}) => handleConfig(context.device),
    },
  },
});
