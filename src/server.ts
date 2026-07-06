// Sentry must initialize before the request handler is created.
import './instrument.server';
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import {wrapFetchWithSentry} from '@sentry/tanstackstart-react';
import {shortUrlRedirect} from './server/shortUrlRedirect';

const handler = createStartHandler(defaultStreamHandler);

export default wrapFetchWithSentry({
  fetch: async (request: Request) => {
    // kult.wiki short-URL redirects (no-op for every other host)
    const shortUrl = await shortUrlRedirect(request);
    if (shortUrl) {
      return shortUrl;
    }

    const url = new URL(request.url);
    const match = url.pathname.match(/^\/\$([\$c])\/([A-Za-z0-9\-_]+)\/?$/);

    if (match && match.length === 3) {
      const route = match[1] === 'c' ? 'crew' : 'kult';
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/card/${match[2]}/${route}`,
        },
      });
    }

    return handler(request);
  },
});
