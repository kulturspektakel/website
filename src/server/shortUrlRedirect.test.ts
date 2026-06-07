import {beforeEach, describe, expect, test, vi} from 'vitest';

const {findUnique} = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));
vi.mock('./prismaClient.server', () => ({
  prismaClient: {
    shortDomainRedirect: {findUnique},
  },
}));

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
    expect(findUnique).toHaveBeenCalledWith({where: {slug: '/foo'}});
  });

  test('kult.wiki + unknown slug → 404', async () => {
    findUnique.mockResolvedValueOnce(null);
    const res = await shortUrlRedirect(req('kult.wiki', '/missing'));
    expect(res?.status).toBe(404);
    expect(findUnique).toHaveBeenCalledWith({where: {slug: '/missing'}});
  });

  test('trailing slash is normalized before lookup', async () => {
    findUnique.mockResolvedValueOnce(null);
    await shortUrlRedirect(req('kult.wiki', '/bar/'));
    expect(findUnique).toHaveBeenCalledWith({where: {slug: '/bar'}});
  });

  test('root path is left untouched', async () => {
    findUnique.mockResolvedValueOnce(null);
    await shortUrlRedirect(req('kult.wiki', '/'));
    expect(findUnique).toHaveBeenCalledWith({where: {slug: '/'}});
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
});
