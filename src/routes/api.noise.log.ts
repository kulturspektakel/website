import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {deviceAuth} from '../server/apiAuth.server';
import {handleNoiseLog} from '../server/noise';

export const Route = createFileRoute('/api/noise/log')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth('NOISE_MONITOR')],
    handlers: {
      POST: ({request, context}) => handleNoiseLog(request, context.device),
    },
  },
});
