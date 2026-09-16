import {beforeEach, describe, expect, test, vi} from 'vitest';

const {prismaMock} = vi.hoisted(() => ({
  prismaMock: {
    bandApplication: {findUnique: vi.fn(), update: vi.fn()},
  },
}));

vi.mock('../../server/prismaClient.server', () => ({prismaClient: prismaMock}));

const {handleInstagramFollower} = await import('./instagram-follower');

function request(id: string) {
  return new Request('https://example.test/x', {
    method: 'POST',
    body: JSON.stringify({id}),
    headers: {'content-type': 'application/json'},
  });
}

/** Stub the Apify run-sync call with the dataset items it would return. */
function mockApify(items: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(items, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.env.APIFY_TOKEN = 'apify_api_test';
  prismaMock.bandApplication.update.mockResolvedValue({});
});

describe('handleInstagramFollower', () => {
  test('stores the follower count from the actor run', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: 'kulturspektakel',
    });
    const fetchMock = mockApify([
      {username: 'kulturspektakel', followersCount: 2570, private: false},
    ]);

    const res = await handleInstagramFollower(request('app1'));
    expect(res.status).toBe(204);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('apify~instagram-profile-scraper');
    expect(options.headers.Authorization).toBe('Bearer apify_api_test');
    expect(JSON.parse(options.body)).toEqual({usernames: ['kulturspektakel']});

    expect(prismaMock.bandApplication.update).toHaveBeenCalledWith({
      where: {id: 'app1'},
      data: {instagramFollower: 2570},
    });
  });

  test('skips applications without an instagram handle', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: null,
    });
    const fetchMock = mockApify([]);

    const res = await handleInstagramFollower(request('app1'));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.bandApplication.update).not.toHaveBeenCalled();
  });

  test('skips junk handles without paying for an actor run', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: 'https://instagram.com/foo?utm=1',
    });
    const fetchMock = mockApify([]);

    const res = await handleInstagramFollower(request('app1'));
    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prismaMock.bandApplication.update).not.toHaveBeenCalled();
  });

  test('treats an unknown handle as a no-op', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: 'nope',
    });
    mockApify([
      {username: 'nope', error: 'not_found', errorDescription: 'Post does not exist'},
    ]);

    const res = await handleInstagramFollower(request('app1'));
    expect(res.status).toBe(204);
    expect(prismaMock.bandApplication.update).not.toHaveBeenCalled();
  });

  test('throws when the actor returns no usable item, so the task retries', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: 'kulturspektakel',
    });
    mockApify([]);

    await expect(handleInstagramFollower(request('app1'))).rejects.toThrow(
      /No follower count/,
    );
  });

  test('throws on an Apify error response', async () => {
    prismaMock.bandApplication.findUnique.mockResolvedValue({
      id: 'app1',
      instagram: 'kulturspektakel',
    });
    mockApify({error: {message: 'nope'}}, {status: 401});

    await expect(handleInstagramFollower(request('app1'))).rejects.toThrow(
      /Apify HTTP401/,
    );
  });
});
