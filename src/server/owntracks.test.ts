import {beforeEach, describe, expect, test, vi} from 'vitest';
import {createHash} from 'node:crypto';
import {PgDialect} from 'drizzle-orm/pg-core';
import type {SQL} from 'drizzle-orm';

const {findFirst, create, friends, where} = vi.hoisted(() => ({
  findFirst: vi.fn(),
  // `db.insert(viewerLocation).values(row)`
  create: vi.fn(),
  // Rows the friends `selectDistinctOn` query resolves to.
  friends: vi.fn(),
  // The friends query's `where` condition.
  where: vi.fn(),
}));
vi.mock('./db.server', () => {
  // The friends query is one builder chain ending in `orderBy`, which resolves
  // to the rows.
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: (condition: SQL) => {
      where(condition);
      return chain;
    },
    orderBy: () => friends(),
  };
  return {
    db: {
      query: {viewer: {findFirst}},
      insert: () => ({values: create}),
      selectDistinctOn: () => chain,
    },
  };
});

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
    findFirst.mockResolvedValueOnce({id: 'U1'});
    friends.mockResolvedValueOnce([]);
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
        latitude: 48.1,
        longitude: 11.3,
        viewerId: 'U1',
      }),
    );
  });

  test('friend cards/locations use the viewer id as tid (unique, not initials)', async () => {
    findFirst.mockResolvedValueOnce({id: 'U1'});
    friends.mockResolvedValueOnce([
      {
        id: 'U2',
        displayName: 'Daniel Büchele',
        latitude: 1,
        longitude: 2,
        createdAt: new Date(0),
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
    findFirst.mockResolvedValueOnce({id: 'U1'});
    friends.mockResolvedValueOnce([
      {
        id: 'U2',
        displayName: 'Daniel Büchele',
        profilePicture: 'https://slack/avatar_192.png',
        // handler requests the smaller _48 variant for the map pin
        latitude: 1,
        longitude: 2,
        createdAt: new Date(0),
      },
    ]);
    const res = await handleOwnTracks(
      ingest('U1', password('U1'), {_type: 'location', lat: 1, lon: 2, tst: 1}),
    );
    const body = (await res.json()) as Array<{_type: string; face?: string}>;
    expect(fetchMock).toHaveBeenCalledWith(
      'https://slack/avatar_48.png',
      expect.objectContaining({signal: expect.anything()}),
    );
    expect(body.find((m) => m._type === 'card')?.face).toBe(
      Buffer.from('PNGBYTES').toString('base64'),
    );
    vi.unstubAllGlobals();
  });

  test('friends response excludes the requesting viewer (no self-duplicate)', async () => {
    findFirst.mockResolvedValueOnce({id: 'U1'});
    friends.mockResolvedValueOnce([]);
    await handleOwnTracks(
      ingest('U1', password('U1'), {_type: 'location', lat: 1, lon: 2, tst: 1}),
    );
    // The requester's id is a bound parameter of the `<>` filter.
    const {sql, params} = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(sql).toContain('<>');
    expect(params).toContain('U1');
  });

  test('empty body does not throw, returns friends view without persisting', async () => {
    // OwnTracks sometimes POSTs an empty body; must not crash on JSON.parse.
    findFirst.mockResolvedValueOnce({id: 'U1'});
    friends.mockResolvedValueOnce([]);
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
