import {beforeAll, describe, expect, test} from 'vitest';
import {baseUrl, ownTracksHeaders, query} from '../../test/e2e/client';

const post = (viewerId: string, body: unknown) =>
  fetch(`${baseUrl}/api/owntracks`, {
    method: 'POST',
    headers: {
      ...ownTracksHeaders(viewerId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

const location = (lat: number) => ({
  _type: 'location',
  lat,
  lon: 11.38,
  tst: Math.floor(Date.now() / 1000),
});

describe('POST /api/owntracks', () => {
  beforeAll(async () => {
    await query(
      `insert into "Viewer"(id, "displayName", email)
       values ('UOT1', 'Ada One', 'a@x'), ('UOT2', 'Bea Two', 'b@x')`,
    );
  });

  test('stores the location and answers with the other viewers', async () => {
    await post('UOT2', location(48.1));
    const res = await post('UOT1', location(48.06));
    expect(res.status).toBe(200);

    const [{n}] = await query<{n: number}>(
      `select count(*)::int n from "ViewerLocation" where "viewerId" = 'UOT1'`,
    );
    expect(n).toBe(1);
    // Only the other viewer comes back (a card and a location).
    const messages: {_type: string; tid: string}[] = await res.json();
    expect(messages.map((m) => [m._type, m.tid])).toEqual([
      ['card', 'UOT2'],
      ['location', 'UOT2'],
    ]);
  });

  test('rejects a valid password for a viewer that does not exist', async () => {
    expect((await post('UGONE', location(48))).status).toBe(401);
    expect((await post('UGONE', {_type: 'waypoints'})).status).toBe(401);
  });
});
