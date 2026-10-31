import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../server/apiError.server';
import {handleAppleWalletPass} from '../server/appleWalletPass';

export const Route = createFileRoute('/api/crewcard/wallet/apple/$payload')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      GET: ({params}) => handleAppleWalletPass(params.payload),
    },
  },
});
