import {beforeEach, describe, expect, test, vi} from 'vitest';
import {createHash} from 'node:crypto';

const {findUnique, create, findMany} = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock('./prismaClient.server', () => ({
  prismaClient: {
    viewer: {findUnique, findMany},
    viewerLocation: {create},
  },
}));

process.env.JWT_SECRET = 'test-jwt-secret';
const {handleOwnTracks} = await import('./owntracks');

const password = (viewerId: string) =>
  createHash('sha1')
    .update(`${viewerId}${process.env.JWT_SECRET}`)
    .digest('hex');

function ingest(viewerId: string, pass: string, body: unknown) {
  return new Request('https://test/owntracks', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(`${viewerId}:${pass}`).toString('base64')}`,
    },
  });
}

beforeEach(() => vi.clearAllMocks());

describe('handleOwnTracks', () => {
  test('valid auth + location persists a ViewerLocation', async () => {
    findUnique.mockResolvedValueOnce({id: 'U1'});
    findMany.mockResolvedValueOnce([]);
    const res = await handleOwnTracks(
      ingest('U1', password('U1'), {
        _type: 'location',
        lat: 48.1,
        lon: 11.3,
        tst: 1_700_000_000,
      }),
    );
    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({latitude: 48.1, longitude: 11.3, viewerId: 'U1'}),
      }),
    );
  });

  test('wrong password is rejected with 401', async () => {
    // The handler throws ApiError(401); apiErrorBoundary turns it into a 401 in prod.
    await expect(
      handleOwnTracks(
        ingest('U1', 'wrong', {_type: 'location', lat: 1, lon: 2, tst: 1}),
      ),
    ).rejects.toMatchObject({code: 401});
    expect(create).not.toHaveBeenCalled();
  });
});
