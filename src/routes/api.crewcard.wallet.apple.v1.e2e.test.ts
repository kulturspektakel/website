import {beforeAll, describe, expect, inject, test} from 'vitest';
import {baseUrl, query} from '../../test/e2e/client';
import {encodeCrewCardPayload} from '../utils/decodePayload';

const base = `${baseUrl}/api/crewcard/wallet/apple/v1`;
const PASS_TYPE = 'pass.de.kulturspektakel.crew';
const SERIAL = 'A1E2E000000001';
const TOKEN = 'e2e-token-e2e-token-e2e-token';
const ENROLLED_AT = new Date('2026-11-01T12:00:00.000Z');
// Kult epoch day 940 (kultEpochToDate: 2025-01-02 04:00 local + 940 days).
const VALID_UNTIL = new Date(2025, 0, 2 + 940, 4);

const SNAPSHOT = {
  eventId: 'e2e-wallet-kult',
  holderName: 'Erika Mustermann',
  privileged: false,
  bookingsTotal: 0,
  badges: 0,
  message: null,
};

const auth = (token = TOKEN) => ({Authorization: `ApplePass ${token}`});

const register = (
  device: string,
  {serial = SERIAL, token = TOKEN, pushToken = `push-${device}`} = {},
) =>
  fetch(`${base}/devices/${device}/registrations/${PASS_TYPE}/${serial}`, {
    method: 'POST',
    headers: {...auth(token), 'Content-Type': 'application/json'},
    body: JSON.stringify({pushToken}),
  });

const registrations = () =>
  query<{deviceLibraryIdentifier: string; pushToken: string}>(
    `select "deviceLibraryIdentifier", "pushToken" from "WalletPassRegistration"
     order by "deviceLibraryIdentifier"`,
  );

describe('Apple Wallet web service', () => {
  beforeAll(async () => {
    // The festival the cards are for: the first one ending after issue.
    await query(
      `insert into "Event"(id, name, start, "end", "eventType")
       values ('e2e-wallet-kult', 'Kult E2E', '2027-07-23', '2027-07-26', 'Kulturspektakel')`,
    );
    // The first card's pass is installed (it has its snapshot); the second
    // was just issued, so its download is still open.
    await query(
      `insert into "CrewCard"(id, "validUntil", "enrolledAt", "cardType", "walletAuthToken", "walletPass")
       values (decode($1, 'hex'), $2, $3, 'APPLE_WALLET', $4, $5),
              (decode('A1E2E000000002', 'hex'), $2, now(), 'APPLE_WALLET', 'other-token-other-token', null)`,
      [SERIAL, VALID_UNTIL, ENROLLED_AT, TOKEN, SNAPSHOT],
    );
  });

  test('registration needs the pass token', async () => {
    expect((await register('dev1', {token: 'wrong-token'})).status).toBe(401);
    // Another card's token doesn't work either.
    expect(
      (await register('dev1', {token: 'other-token-other-token'})).status,
    ).toBe(401);
    expect((await register('dev1', {serial: 'A1E2E0000000FF'})).status).toBe(
      401,
    );
    expect(await registrations()).toEqual([]);
  });

  test('registration needs a push token', async () => {
    const res = await fetch(
      `${base}/devices/dev1/registrations/${PASS_TYPE}/${SERIAL}`,
      {method: 'POST', headers: auth(), body: '{}'},
    );
    expect(res.status).toBe(400);
  });

  test('registers once per device, 200 on repeat', async () => {
    expect((await register('dev1')).status).toBe(201);
    expect((await register('dev1')).status).toBe(200);
    expect((await register('dev2')).status).toBe(201);
    expect(await registrations()).toEqual([
      {deviceLibraryIdentifier: 'dev1', pushToken: 'push-dev1'},
      {deviceLibraryIdentifier: 'dev2', pushToken: 'push-dev2'},
    ]);
  });

  test("a device's new push token replaces the old one", async () => {
    expect((await register('dev1', {pushToken: 'push-dev1-new'})).status).toBe(
      200,
    );
    expect((await registrations())[0].pushToken).toBe('push-dev1-new');
  });

  test("lists the device's passes changed since the tag", async () => {
    const url = `${base}/devices/dev1/registrations/${PASS_TYPE}`;
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      serialNumbers: [SERIAL],
      lastUpdated: String(ENROLLED_AT.getTime()),
    });

    const since = await fetch(
      `${url}?passesUpdatedSince=${ENROLLED_AT.getTime()}`,
    );
    expect(since.status).toBe(204);
    expect(
      (await fetch(`${base}/devices/unknown/registrations/${PASS_TYPE}`))
        .status,
    ).toBe(204);
    expect(
      (await fetch(`${base}/devices/dev1/registrations/pass.other`)).status,
    ).toBe(404);
  });

  test('serves the current pass, 304 when unchanged', async () => {
    const url = `${base}/passes/${PASS_TYPE}/${SERIAL}`;
    expect((await fetch(url)).status).toBe(401);
    expect((await fetch(url, {headers: auth('wrong-token')})).status).toBe(401);

    const res = await fetch(url, {headers: auth()});
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.apple.pkpass',
    );
    expect(res.headers.get('Last-Modified')).toBe(ENROLLED_AT.toUTCString());
    // A zip archive.
    expect(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');

    const unchanged = await fetch(url, {
      headers: {...auth(), 'If-Modified-Since': ENROLLED_AT.toUTCString()},
    });
    expect(unchanged.status).toBe(304);
  });

  test('a pass is created with a snapshot for its festival', async () => {
    const url = `${base}/passes/${PASS_TYPE}/A1E2E000000002`;
    const headers = auth('other-token-other-token');
    // Only the download creates snapshots; until then there's no pass.
    expect((await fetch(url, {headers})).status).toBe(404);

    // The total counts everything since the card was issued, also outside
    // the festival (badges don't); an order from before it doesn't count.
    await query(
      `with booked as (
         insert into "Order"("crewCardId", payment, "createdAt")
         values (decode('A1E2E000000002', 'hex'), 'FREE_CREW', now()),
                (decode('A1E2E000000002', 'hex'), 'FREE_CREW', '2020-01-01')
         returning id, "createdAt"
       )
       insert into "OrderItem"("orderId", name, amount, "perUnitPrice")
       select id, 'Bier', 2, case when "createdAt" > '2021-01-01' then 175 else 1000 end
       from booked`,
    );

    process.env.CONTACTLESS_SALT = inject('e2e').salt;
    const payload = encodeCrewCardPayload(
      Buffer.from('A1E2E000000002', 'hex'),
      940,
    );
    const download = await fetch(
      `${baseUrl}/api/crewcard/wallet/apple/${payload}`,
      {redirect: 'manual'},
    );
    expect(download.status).toBe(200);
    const [card] = await query<{walletPass: unknown; passUpdatedAt: Date}>(
      `select "walletPass", "passUpdatedAt" from "CrewCard"
       where id = decode('A1E2E000000002', 'hex')`,
    );
    // The first festival ending after issue; no holder.
    expect(card.walletPass).toEqual({
      ...SNAPSHOT,
      holderName: 'Crew',
      bookingsTotal: 350,
    });

    const served = await fetch(url, {headers});
    expect(served.status).toBe(200);
    expect(served.headers.get('Last-Modified')).toBe(
      card.passUpdatedAt.toUTCString(),
    );
  });

  test('unregisters only that device', async () => {
    const res = await fetch(
      `${base}/devices/dev1/registrations/${PASS_TYPE}/${SERIAL}`,
      {method: 'DELETE', headers: auth()},
    );
    expect(res.status).toBe(200);
    expect(await registrations()).toEqual([
      {deviceLibraryIdentifier: 'dev2', pushToken: 'push-dev2'},
    ]);
  });

  test("accepts Wallet's log", async () => {
    const post = (body: unknown) =>
      fetch(`${base}/log`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
    expect((await post({logs: ['something went wrong']})).status).toBe(200);
    expect((await post({nope: true})).status).toBe(400);
  });

  test('anything else is a 404', async () => {
    expect((await fetch(`${base}/whatever`)).status).toBe(404);
    expect((await fetch(`${base}/log`)).status).toBe(404);
  });
});
