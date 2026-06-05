import {createFileRoute} from '@tanstack/react-router';
import {handleConfig} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/config')({
  server: {
    handlers: {
      GET: ({context}) => handleConfig(context.device),
    },
  },
});
