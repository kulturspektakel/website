import {beforeEach, describe, test, expect, vi} from 'vitest';

const {verifyIdToken} = vi.hoisted(() => ({verifyIdToken: vi.fn()}));

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

const {parseGcpToken} = await import('./gcpAuth.server');

const SA_EMAIL = 'tasks@example-proj.iam.gserviceaccount.com';

function request(headers: Record<string, string> = {}) {
  return new Request('https://example.test/api/tasks/heartbeat', {headers});
}

beforeEach(() => {
  verifyIdToken.mockReset();
  process.env.NODE_ENV = 'production';
  process.env.GCP_TASKS_SERVICE_ACCOUNT_EMAIL = SA_EMAIL;
  // Silence the expected error logs from negative-path tests.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('parseGcpToken — production', () => {
  test('accepts a token signed by the expected service account', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({email: SA_EMAIL, email_verified: true}),
    });
    const token = await parseGcpToken(
      request({Authorization: 'Bearer good-jwt'}),
      'heartbeat',
    );
    expect(token).toEqual({iss: 'gcp', email: SA_EMAIL, audience: 'heartbeat'});
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'good-jwt',
      audience: 'heartbeat',
    });
  });

  test('rejects when the Authorization header is missing', async () => {
    expect(await parseGcpToken(request(), 'heartbeat')).toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('rejects when the header is not a Bearer token', async () => {
    expect(
      await parseGcpToken(
        request({Authorization: 'Basic Zm9vOmJhcg=='}),
        'heartbeat',
      ),
    ).toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('rejects when verifyIdToken throws (bad signature, wrong audience, …)', async () => {
    verifyIdToken.mockRejectedValue(new Error('Wrong recipient'));
    expect(
      await parseGcpToken(
        request({Authorization: 'Bearer bad-jwt'}),
        'heartbeat',
      ),
    ).toBeUndefined();
  });

  test('rejects when the signer email does not match', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'attacker@evil.iam.gserviceaccount.com',
        email_verified: true,
      }),
    });
    expect(
      await parseGcpToken(
        request({Authorization: 'Bearer other-sa-jwt'}),
        'heartbeat',
      ),
    ).toBeUndefined();
  });

  test('rejects when email_verified is false', async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({email: SA_EMAIL, email_verified: false}),
    });
    expect(
      await parseGcpToken(
        request({Authorization: 'Bearer unverified-jwt'}),
        'heartbeat',
      ),
    ).toBeUndefined();
  });

  test('rejects when GCP_TASKS_SERVICE_ACCOUNT_EMAIL is unset', async () => {
    delete process.env.GCP_TASKS_SERVICE_ACCOUNT_EMAIL;
    expect(
      await parseGcpToken(
        request({Authorization: 'Bearer good-jwt'}),
        'heartbeat',
      ),
    ).toBeUndefined();
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});

describe('parseGcpToken — dev bypass', () => {
  test('returns a stub token without verification when NODE_ENV is not production', async () => {
    process.env.NODE_ENV = 'development';
    const token = await parseGcpToken(request(), 'heartbeat');
    expect(token).toEqual({iss: 'gcp', email: 'dev@local', audience: 'heartbeat'});
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
});
