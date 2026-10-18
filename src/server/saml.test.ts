import {beforeEach, describe, expect, test, vi} from 'vitest';
import {subMinutes, addMinutes} from 'date-fns';

// `deletes` resolves to the rows `db.delete(nonce)…returning()` returns.
const {db, query, deletes} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);
vi.mock('./db.server', () => ({db}));

const GONE = '00000000-0000-4000-8000-000000000001';
const EXPIRED = '00000000-0000-4000-8000-000000000002';
const VALID = '00000000-0000-4000-8000-000000000003';

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
    expect(deletes).not.toHaveBeenCalled();
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
    expect(deletes).not.toHaveBeenCalled();
  });

  test('redirects when the nonce no longer exists (consumed/expired)', async () => {
    // Deleting a row that isn't there returns nothing.
    deletes.mockResolvedValueOnce([]);
    const res = await handleSamlLogin(getLogin({nonce: GONE}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
    expect(deletes).toHaveBeenCalledWith('Nonce', [GONE]);
  });

  test('redirects on a malformed nonce without touching the database', async () => {
    const res = await handleSamlLogin(getLogin({nonce: 'not-a-uuid'}));
    expect(res.status).toBe(302);
    expect(deletes).not.toHaveBeenCalled();
  });

  test('redirects when the nonce exists but has expired', async () => {
    deletes.mockResolvedValueOnce([
      {createdForId: 'U1', expiresAt: subMinutes(new Date(), 1)},
    ]);
    const res = await handleSamlLogin(getLogin({nonce: EXPIRED}));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('kult.wiki');
    expect(query.viewer.findFirst).not.toHaveBeenCalled();
  });

  test('consumes a valid nonce before attempting to build a response', async () => {
    // A live nonce passes the auth gate; building the actual SAML response then
    // requires a real SAMLRequest in the query, which these unit tests don't
    // forge — so we only assert the nonce was consumed (deleted) exactly once.
    deletes.mockResolvedValueOnce([
      {createdForId: 'U1', expiresAt: addMinutes(new Date(), 5)},
    ]);
    query.viewer.findFirst.mockResolvedValueOnce({
      displayName: 'Test User',
      email: 'test@example.com',
    });
    await expect(
      handleSamlLogin(getLogin({nonce: VALID})),
    ).rejects.toBeDefined();
    expect(deletes).toHaveBeenCalledTimes(1);
  });
});
