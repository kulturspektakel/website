import * as Sentry from '@sentry/tanstackstart-react';
import {prismaClient} from './prismaClient.server';

// A hit is one row that changes maybe once a year, so let the edge own it: an
// hour of `s-maxage` collapses a whole QR poster into one Neon lookup per
// region, and `stale-while-revalidate` means the expiry is paid by a background
// refresh rather than by whoever happens to scan next. `max-age=0` keeps
// browsers revalidating, so an edited target is never stuck in someone's local
// cache — which is also why this stays a 302: browsers cache a 301 indefinitely
// and a poster already in the wild can't be un-scanned. The edge copy can be
// dropped early by purging the `kult-wiki` cache tag, and any production
// redeploy busts it wholesale (Vercel's cache key includes the deployment URL).
const HIT_CACHE =
  'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400';

// A miss is mostly bots probing for `/wp-admin` and friends. Five minutes
// absorbs a flood; deliberately no `stale-while-revalidate`, so a slug that
// starts existing isn't shadowed for a day by its own cached miss.
const MISS_CACHE = 'public, max-age=0, s-maxage=300';

/**
 * Host-based short-URL redirect for the kult.wiki domain (migrated from the
 * legacy api.kulturspektakel.de `kult.wiki.ts` middleware).
 *
 * Multiple domains point at this deployment, so this only fires for kult.wiki
 * (or a *.kult.wiki subdomain). For any other host it returns `null`, letting
 * the request fall through to the normal app untouched.
 *
 * Vercel's CDN cache key includes the host domain, so caching these responses
 * can't leak a kult.wiki redirect onto www.kulturspektakel.de.
 */
export async function shortUrlRedirect(
  request: Request,
): Promise<Response | null> {
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(':')[0]
    .toLowerCase();

  if (host !== 'kult.wiki' && !host.endsWith('.kult.wiki')) {
    return null;
  }

  // The query string is deliberately dropped: every target is already a deep
  // link carrying its own query (Nuclino, Hex, Drive, Calendar), and appending
  // a scanner's tracking params to those can break them. The fragment never
  // reaches the server at all, so the browser carries it across the 302 for
  // free.
  let slug = new URL(request.url).pathname;
  if (slug.endsWith('/') && slug.length > 1) {
    // remove trailing slash
    slug = slug.slice(0, -1);
  }
  // These are printed on signage and retyped by hand; every stored slug is
  // lowercase, so fold the input rather than expecting people to match case.
  slug = slug.toLowerCase();

  let data: {targetUrl: string} | null = null;
  try {
    data = await prismaClient.shortDomainRedirect.findUnique({where: {slug}});
  } catch (e) {
    // A Neon blip shouldn't 500 a link that's printed on a poster. Report it and
    // return the normal miss response, uncached so it can't outlive the outage.
    Sentry.captureException(e);
    return new Response('Not found', {
      status: 404,
      headers: {'Cache-Control': 'no-store'},
    });
  }

  if (data == null) {
    return new Response('Not found', {
      status: 404,
      headers: {'Cache-Control': MISS_CACHE, 'Vercel-Cache-Tag': 'kult-wiki'},
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: data.targetUrl,
      'Cache-Control': HIT_CACHE,
      // Lets a wrong target be pulled from the edge in seconds
      // (`vercel cache invalidate --tag kult-wiki`) instead of waiting out
      // `s-maxage`.
      'Vercel-Cache-Tag': 'kult-wiki',
    },
  });
}
