import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';
import {shortUrlRedirect} from './server/shortUrlRedirect';

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch: async (...args: Parameters<typeof handler>) => {
    const [request] = args;

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

    return handler(...args);
  },
};
