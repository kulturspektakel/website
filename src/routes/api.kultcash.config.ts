import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';
import {handleConfig} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/config')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth()],
    handlers: {
      GET: ({context}) => handleConfig(context.device),
    },
  },
});
