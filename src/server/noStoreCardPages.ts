import {createMiddleware} from '@tanstack/react-start';
import {setResponseHeader} from '@tanstack/react-start/server';

const CARD_PAGE = /^\/card(\/|$)/;

/**
 * Request middleware: card pages (`/card/<payload>/kult|crew`) are never cached.
 *
 * The `_main` layout's event loader marks every page `public` for an hour,
 * which on a card page means bookings, badges and suspensions showing up late,
 * for a URL that only its holder ever opens (so the cache barely hits anyway).
 * Done here rather than in the card loaders because it runs after the render,
 * whichever loader set `Cache-Control` last.
 *
 * This also covers card 404s: header state set here wins over `notFoundCache`'s
 * direct edit of the response. Not a `.server.ts`, for the same reason as
 * `notFoundCache`.
 */
export const noStoreCardPages = createMiddleware({type: 'request'}).server(
  async ({next, pathname}) => {
    const result = await next();
    if (CARD_PAGE.test(pathname)) {
      // Through the request's header state, not `result.response.headers`:
      // Start applies that state (the loaders' `setResponseHeader`) on top of
      // the response afterwards, so a direct edit here would be overwritten.
      setResponseHeader('Cache-Control', 'private, no-store');
    }
    return result;
  },
);
