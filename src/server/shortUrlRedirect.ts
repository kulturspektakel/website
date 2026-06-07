import {prismaClient} from './prismaClient.server';

/**
 * Host-based short-URL redirect for the kult.wiki domain (migrated from the
 * legacy api.kulturspektakel.de `kult.wiki.ts` middleware).
 *
 * Multiple domains point at this deployment, so this only fires for kult.wiki
 * (or a *.kult.wiki subdomain). For any other host it returns `null`, letting
 * the request fall through to the normal app untouched.
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

  let slug = new URL(request.url).pathname;
  if (slug.endsWith('/') && slug.length > 1) {
    // remove trailing slash
    slug = slug.slice(0, -1);
  }

  const data = await prismaClient.shortDomainRedirect.findUnique({
    where: {slug},
  });

  if (data == null) {
    return new Response('Not found', {status: 404});
  }

  return new Response(null, {
    status: 302,
    headers: {Location: data.targetUrl},
  });
}
