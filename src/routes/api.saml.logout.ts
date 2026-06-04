import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleSamlLogout} from '../server/saml';

export const Route = createFileRoute('/api/saml/logout')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      GET: ({request}) => handleSamlLogout(request),
    },
  },
});
