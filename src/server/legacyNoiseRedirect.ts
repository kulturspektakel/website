// The area's URLs are a rename apart and nothing else, so the answer never varies
// and a day at the edge costs nothing. `max-age=0` keeps browsers asking, which is
// the same reason this is a 307 and not a 308: a permanent redirect is cached in
// the browser for good, and there is nothing here worth being unable to take back.
const CACHE = 'public, max-age=0, s-maxage=86400';

const OLD_PREFIX = '/crew/lautstaerke';
const NEW_PREFIX = '/crew/noise';

// The German segments, in the shape they appear in a path. Only `projekt` is
// followed by more (the project id), which is why it keeps its trailing slash and
// the two views don't: `karte`/`liste` are always last.
const SEGMENTS: ReadonlyArray<[from: string, to: string]> = [
  ['/projekt/', '/project/'],
  ['/karte', '/map'],
  ['/liste', '/list'],
];

/**
 * Forwards the noise area's old German URLs to their English replacements.
 *
 * `/crew/lautstaerke/projekt/<id>/karte` → `/crew/noise/project/<id>/map`, and so on
 * for the four shapes the area had. Returns `null` for every other path, so it is a
 * no-op for the rest of the site.
 *
 * Here rather than as a `routeRules` redirect in vite.config.ts — where /vegan and
 * /glutenfrei live — because `karte`→`map` sits in the *middle* of the path, and a
 * route rule can only forward a single trailing `/**` wildcard. Doing it in the
 * request handler also means `vite dev` behaves like production, which route rules
 * (edge-only) do not.
 */
export function legacyNoiseRedirect(request: Request): Response | null {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');

  // Exactly the area or something beneath it — never a sibling that merely starts
  // with the same letters.
  if (path !== OLD_PREFIX && !path.startsWith(`${OLD_PREFIX}/`)) {
    return null;
  }

  let rest = path.slice(OLD_PREFIX.length);
  for (const [from, to] of SEGMENTS) {
    rest = rest.replace(from, to);
  }

  return new Response(null, {
    status: 307,
    headers: {
      // The search string comes across untouched: `?live/from/to` is a moment
      // someone pinned and sent, and dropping it lands them on a different page
      // than the link promised.
      Location: `${NEW_PREFIX}${rest}${url.search}`,
      'Cache-Control': CACHE,
    },
  });
}
