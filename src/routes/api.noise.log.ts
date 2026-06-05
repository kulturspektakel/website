import {createFileRoute} from '@tanstack/react-router';
import {handleNoiseLog} from '../server/noise';

export const Route = createFileRoute('/api/noise/log')({
  server: {
    handlers: {
      POST: ({request, context}) => handleNoiseLog(request, context.device),
    },
  },
});
