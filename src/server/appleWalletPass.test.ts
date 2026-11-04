import {createPublicKey} from 'crypto';
import forge from 'node-forge';
import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import {encodeCrewCardPayload} from '../utils/decodePayload';
import {kultEpochToDate} from '../utils/cardUtils';

const {db} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);
vi.mock('./db.server', () => ({db}));

const {handleAppleWalletPass} = await import('./appleWalletPass');

// A throwaway key standing in for the real one (the committed certificate is
// public; signing with a key that doesn't match it still exercises the build).
beforeAll(() => {
  vi.stubEnv('CONTACTLESS_SALT', 'salt');
  vi.stubEnv(
    'APPLE_WALLET_CREW_PASS_PRIVATE_KEY',
    forge.pki.privateKeyToPem(forge.pki.rsa.generateKeyPair(2048).privateKey),
  );
});

const cardId = new Uint8Array([0xa1, 1, 2, 3, 4, 5, 6]);
const payload = () => encodeCrewCardPayload(cardId, 940);

function walletCard(createdAgoMs: number) {
  return {
    id: Buffer.from(cardId),
    cardType: 'APPLE_WALLET',
    suspended: false,
    privileged: false,
    enrolledAt: new Date(Date.now() - createdAgoMs),
    validUntil: kultEpochToDate(940),
    nickname: null,
    walletAuthToken: 'token-token-token-token',
    passUpdatedAt: null,
    walletMessage: null,
    viewer: {displayName: 'Erika Mustermann'},
  };
}

beforeEach(() => vi.clearAllMocks());

describe('handleAppleWalletPass', () => {
  test('serves a signed pass right after the card was created', async () => {
    db.query.crewCard.findFirst.mockResolvedValue(walletCard(60_000));
    const res = await handleAppleWalletPass(payload());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe(
      'application/vnd.apple.pkpass',
    );
    // A zip archive.
    expect(
      Buffer.from(await res.arrayBuffer())
        .subarray(0, 2)
        .toString(),
    ).toBe('PK');
  });

  test('redirects to the card page for a card without a token', async () => {
    db.query.crewCard.findFirst.mockResolvedValue({
      ...walletCard(60_000),
      walletAuthToken: null,
    });
    const res = await handleAppleWalletPass(payload());
    expect(res.status).toBe(302);
  });

  test('redirects to the card page once the window has passed', async () => {
    db.query.crewCard.findFirst.mockResolvedValue(walletCard(6 * 60_000));
    const res = await handleAppleWalletPass(payload());
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe(`/card/${payload()}/crew`);
  });
});

test('the NFC key is a compressed P-256 point, which Wallet requires', async () => {
  const {NFC_PUBLIC_KEY} = await import('./appleWallet/pass.server');
  const key = createPublicKey({
    key: Buffer.from(NFC_PUBLIC_KEY, 'base64'),
    format: 'der',
    type: 'spki',
  });
  expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
  // The SPKI ends in the point: 0x02/0x03 + 32-byte x when compressed.
  const point = Buffer.from(NFC_PUBLIC_KEY, 'base64').subarray(-33);
  expect([0x02, 0x03]).toContain(point[0]);
});

test('the pass points Wallet at the web service', async () => {
  const {crewPassJson, WALLET_WEB_SERVICE_URL} =
    await import('./appleWallet/pass.server');
  const json = crewPassJson({
    serialNumber: 'A1010203040506',
    cardId: 'A1:01:02:03:04:05:06',
    authenticationToken: 'token-token-token-token',
    payload: payload(),
    holderName: 'Erika Mustermann',
    lastValidDay: 'Mo., 26.07.2027',
    validUntil: kultEpochToDate(940),
    privileged: false,
    message: 'Schichtplan ist online',
  });
  // The message notifies when it changes.
  expect(json.generic.backFields[0]).toEqual({
    key: 'message',
    label: 'Neuigkeiten',
    value: 'Schichtplan ist online',
    changeMessage: '%@',
  });
  expect(json).toMatchObject({
    serialNumber: 'A1010203040506',
    webServiceURL: WALLET_WEB_SERVICE_URL,
    authenticationToken: 'token-token-token-token',
    nfc: {message: payload()},
  });
  // Wallet ignores the web service unless it's HTTPS.
  expect(WALLET_WEB_SERVICE_URL).toMatch(/^https:\/\//);
});

test('kultEpochOfDate inverts kultEpochToDate', async () => {
  const {kultEpochOfDate} = await import('../utils/cardUtils');
  expect(kultEpochOfDate(kultEpochToDate(940))).toBe(940);
  expect(() =>
    kultEpochOfDate(new Date(kultEpochToDate(940).getTime() + 1)),
  ).toThrow();
});
