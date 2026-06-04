import {beforeEach, describe, expect, test, vi} from 'vitest';
import {subMinutes, addMinutes} from 'date-fns';

const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {nonce: {delete: vi.fn()}},
}));
vi.mock('./prismaClient.server', () => ({prismaClient: prismaMock}));

// IdentityProvider/ServiceProvider are constructed at module import, so the env
// they read must be set first. The redirect-path tests below never sign a
// response, so a placeholder private key is enough.
process.env.SITE_URL = 'https://test.kulturspektakel.de';
process.env.NUCLINO_TEAM_ID = 'team123';
process.env.NUCLINO_ANONYMOUS_PASSWORD = 'shared-wiki-pw';
process.env.SAML_PRIVATE_KEY = 'test-private-key';

const {handleSamlLogin} = await import('./saml');

const LOGIN = 'https://test.kulturspektakel.de/saml/login';

function postLogin(fields: Record<string, string>) {
  return new Request(LOGIN, {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: {'content-type': 'application/x-www-form-urlencoded'},
  });
}

function getLogin(query: Record<string, string> = {}) {
  const url = new URL(LOGIN);
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url, {method: 'GET'});
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('handleSamlLogin password fallback', () => {
  test('rejects a wrong password by redirecting to the wiki', async () => {
    const res = await handleSamlLogin(postLogin({password: 'nope'}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
    expect(prismaMock.nonce.delete).not.toHaveBeenCalled();
  });

  test('rejects a missing password by redirecting to the wiki', async () => {
    const res = await handleSamlLogin(postLogin({}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
  });

  test('parses the urlencoded body so a correct password passes the gate', async () => {
    // Regression: the body must be read from the raw form, not request.formData()
    // (which is empty on the deployed runtime). A correct password gets past the
    // redirect gate into sendSAMLResponse, which then rejects here because no
    // SAMLRequest is present — anything other than a kult.wiki redirect proves the
    // password was parsed and matched.
    await expect(
      handleSamlLogin(postLogin({password: 'shared-wiki-pw'})),
    ).rejects.toBeDefined();
  });
});

describe('handleSamlLogin nonce flow', () => {
  test('redirects to the wiki when no nonce is supplied', async () => {
    const res = await handleSamlLogin(getLogin());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
    expect(prismaMock.nonce.delete).not.toHaveBeenCalled();
  });

  test('redirects when the nonce no longer exists (consumed/expired)', async () => {
    // Prisma throws P2025 when deleting a row that isn't there.
    prismaMock.nonce.delete.mockRejectedValueOnce(new Error('P2025'));
    const res = await handleSamlLogin(getLogin({nonce: 'gone'}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
    expect(prismaMock.nonce.delete).toHaveBeenCalledWith({
      where: {nonce: 'gone'},
      select: {createdFor: true, expiresAt: true},
    });
  });

  test('redirects when the nonce exists but has expired', async () => {
    prismaMock.nonce.delete.mockResolvedValueOnce({
      createdFor: {displayName: 'Test User', email: 'test@example.com'},
      expiresAt: subMinutes(new Date(), 1),
    });
    const res = await handleSamlLogin(getLogin({nonce: 'expired'}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
  });

  test('consumes a valid nonce before attempting to build a response', async () => {
    // A live nonce passes the auth gate; building the actual SAML response then
    // requires a real SAMLRequest in the query, which these unit tests don't
    // forge — so we only assert the nonce was consumed (deleted) exactly once.
    prismaMock.nonce.delete.mockResolvedValueOnce({
      createdFor: {displayName: 'Test User', email: 'test@example.com'},
      expiresAt: addMinutes(new Date(), 5),
    });
    await expect(
      handleSamlLogin(getLogin({nonce: 'valid'})),
    ).rejects.toBeDefined();
    expect(prismaMock.nonce.delete).toHaveBeenCalledTimes(1);
  });
});
