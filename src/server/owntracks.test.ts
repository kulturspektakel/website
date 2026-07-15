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

  test('friend cards/locations use the viewer id as tid (unique, not initials)', async () => {
    findUnique.mockResolvedValueOnce({id: 'U1'});
    findMany.mockResolvedValueOnce([
      {
        id: 'U2',
        displayName: 'Daniel Büchele',
        ViewerLocation: [{latitude: 1, longitude: 2, createdAt: new Date(0)}],
      },
    ]);
    const res = await handleOwnTracks(
      ingest('U1', password('U1'), {_type: 'location', lat: 1, lon: 2, tst: 1}),
    );
    const body = (await res.json()) as Array<{_type: string; tid: string}>;
    expect(body).toHaveLength(2);
    expect(body.every((m) => m.tid === 'U2')).toBe(true);
    expect(body.find((m) => m._type === 'card')).toMatchObject({
      name: 'Daniel Büchele',
      tid: 'U2',
    });
  });

  test('card face is the base64-encoded avatar fetched from profilePicture', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode('PNGBYTES').buffer,
    });
    vi.stubGlobal('fetch', fetchMock);
    findUnique.mockResolvedValueOnce({id: 'U1'});
    findMany.mockResolvedValueOnce([
      {
        id: 'U2',
        displayName: 'Daniel Büchele',
        profilePicture: 'https://slack/avatar_192.png',
        // handler requests the smaller _48 variant for the map pin
        ViewerLocation: [{latitude: 1, longitude: 2, createdAt: new Date(0)}],
      },
    ]);
    const res = await handleOwnTracks(
      ingest('U1', password('U1'), {_type: 'location', lat: 1, lon: 2, tst: 1}),
    );
    const body = (await res.json()) as Array<{_type: string; face?: string}>;
    expect(fetchMock).toHaveBeenCalledWith('https://slack/avatar_48.png');
    expect(body.find((m) => m._type === 'card')?.face).toBe(
      Buffer.from('PNGBYTES').toString('base64'),
    );
    vi.unstubAllGlobals();
  });

  test('friends response excludes the requesting viewer (no self-duplicate)', async () => {
    findUnique.mockResolvedValueOnce({id: 'U1'});
    findMany.mockResolvedValueOnce([]);
    await handleOwnTracks(
      ingest('U1', password('U1'), {_type: 'location', lat: 1, lon: 2, tst: 1}),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({id: {not: 'U1'}}),
      }),
    );
  });

  test('empty body does not throw, returns friends view without persisting', async () => {
    // OwnTracks sometimes POSTs an empty body; must not crash on JSON.parse.
    findUnique.mockResolvedValueOnce({id: 'U1'});
    findMany.mockResolvedValueOnce([]);
    const req = new Request('https://test/owntracks', {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`U1:${password('U1')}`).toString('base64')}`,
      },
    });
    const res = await handleOwnTracks(req);
    expect(res.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
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
