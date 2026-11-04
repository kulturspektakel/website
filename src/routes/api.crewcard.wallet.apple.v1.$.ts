import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleAppleWalletWebService} from '../server/appleWalletWebService';

// The PassKit web service under the wallet passes' `webServiceURL`: one route
// for Apple's fixed `/v1/…` paths, dispatched in the handler. Auth (the pass's
// `ApplePass` token) is checked there too.
export const Route = createFileRoute('/api/crewcard/wallet/apple/v1/$')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      GET: ({request, params}) =>
        handleAppleWalletWebService(request, params._splat ?? ''),
      POST: ({request, params}) =>
        handleAppleWalletWebService(request, params._splat ?? ''),
      DELETE: ({request, params}) =>
        handleAppleWalletWebService(request, params._splat ?? ''),
    },
  },
});
