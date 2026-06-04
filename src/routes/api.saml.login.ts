import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';
import {handleSamlLogin} from '../server/routes/saml';

export const Route = createFileRoute('/api/saml/login')({
  server: {
    // No gcpAuth/deviceAuth: GET is authenticated by a one-time nonce and POST
    // by the shared Nuclino password, both checked inside the handler.
    middleware: [apiErrorBoundary],
    handlers: {
      GET: ({request}) => handleSamlLogin(request),
      POST: ({request}) => handleSamlLogin(request),
    },
  },
});
