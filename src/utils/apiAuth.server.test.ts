import {beforeAll, describe, test, expect} from 'vitest';
import {createHash} from 'node:crypto';
import {parseToken} from './apiAuth.server';

const SALT = 'TEST_SALT';
const sign = (data: string) => createHash('sha1').update(data).digest('hex');

beforeAll(() => {
  process.env.CONTACTLESS_SALT = SALT;
});

function request(headers: Record<string, string>) {
  return new Request('https://example.test/api/kultcash/config', {headers});
}

function basicAuth(name: string, pass: string) {
  return 'Basic ' + Buffer.from(`${name}:${pass}`).toString('base64');
}

describe('parseToken — v2 device (Basic auth + product user-agent)', () => {
  test('authenticates a contactless terminal', async () => {
    const token = await parseToken(
      request({
        'User-Agent': 'Contactless/1.2.3',
        Authorization: basicAuth('KASSE1', sign('KASSE1' + SALT)),
      }),
    );
    expect(token).toEqual({iss: 'device', deviceId: 'KASSE1'});
  });

  test('authenticates a noise monitor (other allowed user-agent prefix)', async () => {
    const token = await parseToken(
      request({
        'User-Agent': 'NoiseMonitor/0.1',
        Authorization: basicAuth('NM-1', sign('NM-1' + SALT)),
      }),
    );
    expect(token).toEqual({iss: 'device', deviceId: 'NM-1'});
  });

  test('rejects a wrong password', async () => {
    const token = await parseToken(
      request({
        'User-Agent': 'Contactless/1',
        Authorization: basicAuth('KASSE1', 'not-the-hash'),
      }),
    );
    expect(token).toBeUndefined();
  });

  test('rejects a correct password from a non-device user-agent', async () => {
    const token = await parseToken(
      request({
        'User-Agent': 'curl/8.0',
        Authorization: basicAuth('KASSE1', sign('KASSE1' + SALT)),
      }),
    );
    expect(token).toBeUndefined();
  });
});

describe('parseToken — v1 device (ESP8266)', () => {
  // The firmware sends the device id in `x-esp8266-sta-mac` after a 9-char
  // prefix, and the bearer token is `sha1(deviceId + salt)`.
  const staMac = '012345678AA:BB:CC:DD:EE:FF';
  const deviceId = staMac.substring(9);

  test('authenticates via x-esp8266-sta-mac + Bearer token', async () => {
    const token = await parseToken(
      request({
        'x-esp8266-sta-mac': staMac,
        Authorization: `Bearer ${sign(deviceId + SALT)}`,
      }),
    );
    expect(token).toEqual({iss: 'device', deviceId});
  });

  test('tolerates the "Basic Bearer" authorization prefix', async () => {
    const token = await parseToken(
      request({
        'x-esp8266-sta-mac': staMac,
        Authorization: `Basic Bearer ${sign(deviceId + SALT)}`,
      }),
    );
    expect(token).toEqual({iss: 'device', deviceId});
  });

  test('rejects a wrong token', async () => {
    const token = await parseToken(
      request({
        'x-esp8266-sta-mac': staMac,
        Authorization: 'Bearer wrong',
      }),
    );
    expect(token).toBeUndefined();
  });
});

describe('parseToken — unauthenticated', () => {
  test('returns undefined without credentials', async () => {
    expect(await parseToken(request({}))).toBeUndefined();
  });

  test('returns undefined when CONTACTLESS_SALT is unset', async () => {
    const saved = process.env.CONTACTLESS_SALT;
    delete process.env.CONTACTLESS_SALT;
    try {
      const token = await parseToken(
        request({
          'User-Agent': 'Contactless/1',
          Authorization: basicAuth('KASSE1', sign('KASSE1' + SALT)),
        }),
      );
      expect(token).toBeUndefined();
    } finally {
      process.env.CONTACTLESS_SALT = saved;
    }
  });
});
