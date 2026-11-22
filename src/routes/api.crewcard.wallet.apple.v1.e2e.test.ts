import {beforeAll, describe, expect, inject, test} from 'vitest';
import {baseUrl, query} from '../../test/e2e/client';
import {signPassDownloadToken} from '../server/crewCardPassToken.server';

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
    const [{id: erika}, {id: max}, {id: previous}] = await query<{id: string}>(
      `insert into "CrewCardHolder"(nickname, "pageToken") values
         ('Erika Mustermann', 'wallet-1'), ('Max', 'wallet-2'), ('Vorher', 'wallet-3')
       returning id`,
    );
    // Erika's pass is installed (it has its snapshot). Max's was just issued,
    // so there's no pass yet; he also had a physical card that was replaced,
    // a chip someone else had before him.
    await query(
      `insert into "CrewCard"(serial, "holderId", "validUntil", "enrolledAt", "cardType", "walletAuthToken", "walletPass", "suspendedAt", "suspendedReason")
       values (decode($1, 'hex'), $2, $4, $5, 'APPLE_WALLET', $6, $7, null, null),
              (decode('A1E2E000000002', 'hex'), $3, $4, now(), 'APPLE_WALLET', 'other-token-other-token', null, null, null),
              (decode('53E2E000000003', 'hex'), $8, $4, '2027-07-01', 'PHYSICAL', null, null, null, null),
              (decode('53E2E000000003', 'hex'), $3, $4, '2027-07-24 12:00', 'PHYSICAL', null, null, now(), 'replaced')`,
      [SERIAL, erika, max, VALID_UNTIL, ENROLLED_AT, TOKEN, SNAPSHOT, previous],
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

    // The holder's bookings at the festival, with all their cards: the
    // replaced physical card's count too, also after it was suspended (175 +
    // 200); the chip's previous holder's don't (1000), nor orders outside the
    // festival (50).
    await query(
      `with booked as (
         insert into "Order"("crewCardSerial", payment, "createdAt")
         values (decode('53E2E000000003', 'hex'), 'FREE_CREW', '2027-07-23 18:00'),
                (decode('53E2E000000003', 'hex'), 'FREE_CREW', '2027-07-24 18:00'),
                (decode('A1E2E000000002', 'hex'), 'FREE_CREW', '2027-07-25 18:00'),
                (decode('A1E2E000000002', 'hex'), 'FREE_CREW', '2027-08-01 18:00')
         returning id, "createdAt"
       )
       insert into "OrderItem"("orderId", name, amount, "perUnitPrice")
       select id, 'Bier', 1, case "createdAt"
         when '2027-07-23 18:00' then 1000
         when '2027-07-24 18:00' then 175
         when '2027-07-25 18:00' then 200
         else 50 end
       from booked`,
    );

    process.env.CONTACTLESS_SALT = inject('e2e').salt;
    const [{id: cardId}] = await query<{id: string}>(
      `select id from "CrewCard" where serial = decode('A1E2E000000002', 'hex')`,
    );
    const download = await fetch(
      `${baseUrl}/api/crewcard/wallet/apple/${signPassDownloadToken(cardId)}`,
      {redirect: 'manual'},
    );
    expect(download.status).toBe(200);
    const [card] = await query<{walletPass: unknown; passUpdatedAt: Date}>(
      `select "walletPass", "passUpdatedAt" from "CrewCard" where id = $1`,
      [cardId],
    );
    // The first festival ending after issue.
    expect(card.walletPass).toEqual({
      ...SNAPSHOT,
      holderName: 'Max',
      bookingsTotal: 375,
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
