import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleSamlLogout} from '../server/routes/saml';

export const Route = createFileRoute('/saml/logout')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      GET: ({request}) => handleSamlLogout(request),
    },
  },
});
