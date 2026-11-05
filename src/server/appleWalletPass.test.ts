import {createPublicKey} from 'crypto';
import forge from 'node-forge';
import {beforeAll, beforeEach, describe, expect, test, vi} from 'vitest';
import {encodeCrewCardPayload} from '../utils/decodePayload';
import {kultEpochToDate} from '../utils/cardUtils';

const {db} = await vi.hoisted(async () =>
  (await import('../../test/dbMock')).dbMock(),
);
vi.mock('./db.server', () => ({db}));

const fields = {
  eventId: 'kult2027',
  holderName: 'Erika Mustermann',
  privileged: false,
  bookingsTotal: 2350,
  badges: 3,
  message: 'Schichtplan ist online',
};
// The snapshot logic is covered by the web service e2e test.
const {refreshCrewCardPass} = vi.hoisted(() => ({
  refreshCrewCardPass: vi.fn(),
}));
vi.mock('./crewCardPass.server', () => ({refreshCrewCardPass}));

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
    enrolledAt: new Date(Date.now() - createdAgoMs),
    validUntil: kultEpochToDate(940),
    walletAuthToken: 'token-token-token-token',
    passUpdatedAt: null,
    walletPass: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  refreshCrewCardPass.mockResolvedValue(fields);
});

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

test('the pass is the template with the card filled in', async () => {
  const {crewPassJson, WALLET_WEB_SERVICE_URL, NFC_PUBLIC_KEY} =
    await import('./appleWallet/pass.server');
  const json = crewPassJson({
    serialNumber: 'A1010203040506',
    cardId: 'A1:01:02:03:04:05:06',
    authenticationToken: 'token-token-token-token',
    payload: payload(),
    validUntil: kultEpochToDate(940),
    fields,
  }) as Record<string, any>;

  const byKey: Record<string, Record<string, any>> = Object.fromEntries(
    Object.values(json.generic as Record<string, Array<Record<string, any>>>)
      .flat()
      .map((field) => [field.key, field]),
  );
  expect(byKey.status).toMatchObject({label: 'KULT2027', value: 'CREW'});
  expect(byKey.name).toMatchObject({value: 'Erika Mustermann'});
  // Euros; the template's `currencyCode` formats them.
  expect(byKey.bookings).toMatchObject({value: 23.5, currencyCode: 'EUR'});
  // Only the message notifies (`changeMessage` from the template); the rest
  // updates silently, so an update never changes two notifying fields.
  expect(byKey.badges).toMatchObject({value: 3});
  expect(
    Object.values(byKey)
      .filter((field) => field.changeMessage)
      .map((field) => field.key),
  ).toEqual(['message']);
  expect(byKey.message).toMatchObject({value: 'Schichtplan ist online'});
  expect(byKey.message.changeMessage).toContain('%@');
  // The last valid day, a day before the card runs out.
  expect(byKey.validUntil.value).toBe(
    new Date(kultEpochToDate(939)).toISOString(),
  );
  expect(byKey.cardId).toMatchObject({value: 'A1:01:02:03:04:05:06'});

  // Set by the code, whatever the template says.
  expect(json).toMatchObject({
    serialNumber: 'A1010203040506',
    passTypeIdentifier: 'pass.de.kulturspektakel.crew',
    webServiceURL: WALLET_WEB_SERVICE_URL,
    authenticationToken: 'token-token-token-token',
    sharingProhibited: true,
    expirationDate: kultEpochToDate(940).toISOString(),
    nfc: {message: payload(), encryptionPublicKey: NFC_PUBLIC_KEY},
    featuredActions: [
      {identifier: 'card-page', url: `https://kult.cash/$c/${payload()}`},
    ],
  });
  // Pass Designer's own ids stay out of the pass.
  expect(JSON.stringify(json)).not.toContain('"_id"');
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
