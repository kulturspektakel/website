import {createFileRoute} from '@tanstack/react-router';
import {apiErrorBoundary} from '../utils/apiError.server';

export const Route = createFileRoute('/owntracks/config')({
  server: {
    middleware: [apiErrorBoundary],
    handlers: {
      // Deep-links into the OwnTracks app to import the device config.
      GET: ({request}) => {
        const config = new URL(request.url).searchParams.get('config') ?? '';
        return new Response(null, {
          status: 302,
          headers: {location: `owntracks:///config?inline=${config}`},
        });
      },
    },
  },
});
