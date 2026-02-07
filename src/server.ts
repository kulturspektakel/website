import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server';

const handler = createStartHandler(defaultStreamHandler);

export default {
  fetch: (request: Request, requestContext?: {context?: unknown}) => {
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

    return handler(request, requestContext);
  },
};
