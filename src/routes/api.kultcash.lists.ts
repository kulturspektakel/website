import {createFileRoute} from '@tanstack/react-router';
import {handleLists} from '../server/kultcash';

export const Route = createFileRoute('/api/kultcash/lists')({
  server: {
    handlers: {
      GET: ({request}) => handleLists(request),
    },
  },
});
