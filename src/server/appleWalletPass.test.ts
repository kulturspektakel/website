import {createPublicKey} from 'crypto';
import forge from 'node-forge';
import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import {encodeCrewCardPayload} from '../utils/decodePayload';

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

const payload = () =>
  encodeCrewCardPayload(new Uint8Array([0xa1, 1, 2, 3, 4, 5, 6]), 940);

function walletCard(createdAgoMs: number) {
  return {
    cardType: 'APPLE_WALLET',
    suspended: false,
    enrolledAt: new Date(Date.now() - createdAgoMs),
    validUntil: new Date('2027-07-27T04:00:00Z'),
    nickname: null,
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
