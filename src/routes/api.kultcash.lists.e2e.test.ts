import {describe, test, expect} from 'vitest';
import {baseUrl, deviceHeaders, query} from '../../test/e2e/client';
import {AllLists} from '../proto/configs';

describe('GET /api/kultcash/lists', () => {
  test('returns an encoded protobuf with an ETag', async () => {
    const res = await fetch(`${baseUrl}/api/kultcash/lists`, {
      headers: deviceHeaders('KASSE-LISTS'),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-protobuf');
    expect(res.headers.get('etag')).toBeTruthy();
  });

  test('responds 304 when the ETag matches', async () => {
    const first = await fetch(`${baseUrl}/api/kultcash/lists`, {
      headers: deviceHeaders('KASSE-LISTS'),
    });
    const etag = first.headers.get('etag')!;

    const cached = await fetch(`${baseUrl}/api/kultcash/lists`, {
      headers: {...deviceHeaders('KASSE-LISTS'), 'If-None-Match': etag},
    });
    expect(cached.status).toBe(304);
  });

  test('returns a configured product list with its products', async () => {
    const [{id}] = await query<{id: number}>(
      `insert into "ProductList" (name, active) values ('Cocktailbar', true) returning id`,
    );
    await query(
      `insert into "Product" (name, price, "order", "productListId") values
         ('Caipirinha', 850, 0, $1),
         ('Mojito', 800, 1, $1)`,
      [id],
    );

    const res = await fetch(`${baseUrl}/api/kultcash/lists`, {
      headers: deviceHeaders('KASSE-LISTS'),
    });
    expect(res.status).toBe(200);

    const allLists = AllLists.decode(new Uint8Array(await res.arrayBuffer()));
    const list = allLists.productList.find((l) => l.name === 'Cocktailbar');
    expect(list).toBeDefined();
    expect(list?.listId).toBe(id);
    expect(list?.products).toEqual([
      {name: 'Caipirinha', price: 850},
      {name: 'Mojito', price: 800},
    ]);
  });

  test('ships suspended and privileged CrewCard serials', async () => {
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
    // Only Slack users can be privileged.
    await query(
      `insert into "Viewer" (id, "displayName", email)
       values ('ULISTS', 'Lists Bonbude', 'lists@example.com')`,
    );
    const [{id: privileged}, {id: regular}] = await query<{id: string}>(
      `insert into "CrewCardHolder" ("viewerId", nickname, privileged, "pageToken") values
         ('ULISTS', null, true, 'lists-1'), (null, 'lists-crew', false, 'lists-2')
       returning id`,
    );
    await query(
      `insert into "CrewCard"
         (serial, "cardType", "holderId", "validUntil", "enrolledAt", "issuedAt", "suspendedAt", "suspendedReason", "walletAuthToken")
       values
         -- privileged holder: a live physical card and a pass, an old lost card
         ('\\x11000000000001', 'PHYSICAL', $1, '2030-01-01', '2026-01-01', '2026-01-01', null, null, null),
         ('\\xa1000000000001', 'APPLE_WALLET', $1, '2030-01-01', '2026-01-01', '2026-01-01', null, null, 'lists-token'),
         ('\\x11000000000002', 'PHYSICAL', $1, '2030-01-01', '2025-01-01', '2025-01-01', '2026-01-01', 'lost', null),
         -- a replaced chip that was enrolled again since, and one that wasn't
         ('\\x11000000000003', 'PHYSICAL', $2, '2030-01-01', '2025-01-01', '2025-01-01', '2026-01-01', 'replaced', null),
         ('\\x11000000000004', 'PHYSICAL', $2, '2030-01-01', '2025-01-01', '2025-01-01', '2026-01-01', 'replaced', null),
         -- reassigned: the chip's live card is the new holder's
         ('\\x11000000000005', 'PHYSICAL', $1, '2030-01-01', '2025-01-01', '2025-01-01', '2026-01-01', 'reassigned', null),
         ('\\x11000000000005', 'PHYSICAL', $2, '2030-01-01', '2025-01-01', '2026-01-01', null, null, null)`,
      [privileged, regular],
    );
    await query(
      `insert into "CrewCardEnrollment" (serial, "validUntil", "enrolledAt")
       values ('\\x11000000000003', '2030-01-01', '2026-02-01')`,
    );

    const res = await fetch(`${baseUrl}/api/kultcash/lists`, {
      headers: deviceHeaders('KASSE-LISTS'),
    });
    const allLists = AllLists.decode(new Uint8Array(await res.arrayBuffer()));
    const ours = (serials: Uint8Array[]) =>
      serials.map(hex).filter((s) => /^(11|a1)0000000000/.test(s));
    expect(ours(allLists.suspendedCrewCards)).toEqual([
      '11000000000002',
      '11000000000004',
    ]);
    expect(ours(allLists.privilegeTokens)).toEqual([
      '11000000000001',
      'a1000000000001',
    ]);
  });
});
