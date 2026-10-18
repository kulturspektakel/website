import {beforeEach, describe, expect, test, vi} from 'vitest';

import {whereParams} from '../../test/dbMock';

const {db, query} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);
vi.mock('./db.server', () => ({db}));
const findUnique = query.shortDomainRedirect.findFirst;
// The slug a lookup asked for.
const lookedUp = () => whereParams(findUnique.mock.calls[0][0].where)[0];
vi.mock('@sentry/tanstackstart-react', () => ({captureException: vi.fn()}));

const {shortUrlRedirect} = await import('./shortUrlRedirect');

function req(host: string, path: string) {
  return new Request(`https://internal${path}`, {
    headers: host ? {host} : {},
  });
}

beforeEach(() => vi.clearAllMocks());

describe('shortUrlRedirect', () => {
  test('kult.wiki + known slug → 302 to targetUrl', async () => {
    findUnique.mockResolvedValueOnce({
      slug: '/foo',
      targetUrl: 'https://example.com/foo',
    });
    const res = await shortUrlRedirect(req('kult.wiki', '/foo'));
    expect(res?.status).toBe(302);
    expect(res?.headers.get('location')).toBe('https://example.com/foo');
    expect(lookedUp()).toBe('/foo');
  });

  test('kult.wiki + unknown slug → 404', async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await shortUrlRedirect(req('kult.wiki', '/missing'));
    expect(res?.status).toBe(404);
    expect(lookedUp()).toBe('/missing');
  });

  test('trailing slash is normalized before lookup', async () => {
    findUnique.mockResolvedValueOnce(null);
    await shortUrlRedirect(req('kult.wiki', '/bar/'));
    expect(lookedUp()).toBe('/bar');
  });

  test('root path is left untouched', async () => {
    findUnique.mockResolvedValueOnce(null);
    await shortUrlRedirect(req('kult.wiki', '/'));
    expect(lookedUp()).toBe('/');
  });

  test('subdomain of kult.wiki is handled', async () => {
    findUnique.mockResolvedValueOnce({slug: '/x', targetUrl: 'https://t/'});
    const res = await shortUrlRedirect(req('www.kult.wiki', '/x'));
    expect(res?.status).toBe(302);
  });

  test('host with port still matches', async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await shortUrlRedirect(req('kult.wiki:3000', '/y'));
    expect(res?.status).toBe(404);
  });

  test('x-forwarded-host takes precedence over host', async () => {
    findUnique.mockResolvedValueOnce(null);
    const r = new Request('https://internal/z', {
      headers: {host: 'kulturspektakel.de', 'x-forwarded-host': 'kult.wiki'},
    });
    const res = await shortUrlRedirect(r);
    expect(res?.status).toBe(404);
  });

  test('other domain → null, no DB lookup', async () => {
    const res = await shortUrlRedirect(
      req('www.kulturspektakel.de', '/anything'),
    );
    expect(res).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('lookalike hosts → null, no DB lookup', async () => {
    expect(await shortUrlRedirect(req('notkult.wiki', '/x'))).toBeNull();
    expect(await shortUrlRedirect(req('kult.wiki.evil.com', '/x'))).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('missing host header → null', async () => {
    const res = await shortUrlRedirect(req('', '/x'));
    expect(res).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  test('slug lookup is case-insensitive', async () => {
    findUnique.mockResolvedValueOnce(null);
    await shortUrlRedirect(req('kult.wiki', '/Helfen'));
    expect(lookedUp()).toBe('/helfen');
  });

  test('hits get an hour at the edge, misses five minutes', async () => {
    findUnique.mockResolvedValueOnce({slug: '/a', targetUrl: 'https://t/'});
    const hit = await shortUrlRedirect(req('kult.wiki', '/a'));
    expect(hit?.headers.get('cache-control')).toContain('s-maxage=3600');

    findUnique.mockResolvedValueOnce(null);
    const miss = await shortUrlRedirect(req('kult.wiki', '/b'));
    expect(miss?.headers.get('cache-control')).toBe(
      'public, max-age=0, s-maxage=300',
    );
  });

  test('database failure → 404 that is not cached', async () => {
    findUnique.mockRejectedValueOnce(new Error('neon down'));
    const res = await shortUrlRedirect(req('kult.wiki', '/helfen'));
    expect(res?.status).toBe(404);
    expect(res?.headers.get('cache-control')).toBe('no-store');
  });
});
