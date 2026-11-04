import {beforeAll, describe, expect, test} from 'vitest';
import {baseUrl, query} from '../../test/e2e/client';

const base = `${baseUrl}/api/crewcard/wallet/apple/v1`;
const PASS_TYPE = 'pass.de.kulturspektakel.crew';
const SERIAL = 'A1E2E000000001';
const TOKEN = 'e2e-token-e2e-token-e2e-token';
const ENROLLED_AT = new Date('2026-11-01T12:00:00.000Z');
// Kult epoch day 940 (kultEpochToDate: 2025-01-02 04:00 local + 940 days).
const VALID_UNTIL = new Date(2025, 0, 2 + 940, 4);

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
    await query(
      `insert into "CrewCard"(id, "validUntil", "enrolledAt", "cardType", "walletAuthToken")
       values (decode($1, 'hex'), $2, $3, 'APPLE_WALLET', $4),
              (decode('A1E2E000000002', 'hex'), $2, $3, 'APPLE_WALLET', 'other-token-other-token')`,
      [SERIAL, VALID_UNTIL, ENROLLED_AT, TOKEN],
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
