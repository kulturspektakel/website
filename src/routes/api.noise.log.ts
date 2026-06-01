import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {deviceAuth} from '../utils/apiAuth.server';
import {handleNoiseLog} from '../server/routes/noise';

export const Route = createFileRoute('/api/noise/log')({
  server: {
    middleware: [apiErrorBoundary, deviceAuth('NOISE_MONITOR')],
    handlers: {
      POST: ({request, context}) => handleNoiseLog(request, context.device),
    },
  },
});
