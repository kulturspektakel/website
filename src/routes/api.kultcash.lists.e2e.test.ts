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
});
