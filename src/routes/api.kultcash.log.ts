import {createFileRoute} from '@tanstack/react-router';
import {handleLog} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/log')({
  server: {
    handlers: {
      POST: ({request}) => handleLog(request),
    },
  },
});
