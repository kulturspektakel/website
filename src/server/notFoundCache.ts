import {createMiddleware} from '@tanstack/react-start';

// Paths whose 404s must never reach the shared CDN cache: `/crew/*` is behind
// Directus auth (a 404 there is `notFound()` thrown from a loader, and whether
// a project/application exists is not public), and `/api/*` is machine traffic
// where a cached 404 would outlive the condition that caused it.
const UNCACHEABLE = /^\/(crew|api)(\/|$)/;

/**
 * Request middleware: lets the CDN absorb 404s.
 *
 * Every unmatched URL is otherwise a full function invocation — the SSR handler
 * boots and, for single-segment paths that reach the `_main` layout, runs its
 * `getCurrentEvent` query — before returning `public, max-age=0,
 * must-revalidate`. On a public site the bulk of that traffic is bots probing
 * for `/wp-admin/...` and friends, so the same handful of paths pay for a cold
 * render over and over.
 *
 * `s-maxage` only, with `max-age=0`: the edge holds the 404 for an hour while
 * browsers keep revalidating, so a page that later starts existing (a news slug,
 * a new event) isn't stuck in someone's local cache. An hour matches the
 * `s-maxage` the `_main` layout already sets on real pages.
 *
 * This module is intentionally NOT a `.server.ts`: middleware registered on the
 * `createStart` instance in `src/start.ts` has to clear `.server.*` import
 * protection (same reasoning as `crewAuth`).
 */
export const notFoundCache = createMiddleware({type: 'request'}).server(
  async ({next, pathname}) => {
    const result = await next();

    if (result.response.status === 404 && !UNCACHEABLE.test(pathname)) {
      const existing = result.response.headers.get('cache-control') ?? '';
      // Don't widen anything a route deliberately marked private.
      if (!/private|no-store/i.test(existing)) {
        result.response.headers.set(
          'Cache-Control',
          'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
        );
      }
    }

    return result;
  },
);
