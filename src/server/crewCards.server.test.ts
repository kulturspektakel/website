import {describe, expect, test, vi} from 'vitest';
import {decodePayload, encodeCrewCardPayload} from '../utils/decodePayload';

vi.mock('./db.server', () => ({db: {}}));

const {walletCardValidity} = await import('./crewCards.server');

const now = new Date('2026-10-31T12:00:00Z');

describe('walletCardValidity', () => {
  test('is valid through the day after the event ends', () => {
    const result = walletCardValidity(
      {name: 'Kult 2027', end: new Date('2027-07-25T21:00:00Z')},
      now,
    );
    expect(
      result.ok && result.validUntil > new Date('2027-07-26T21:00:00Z'),
    ).toBe(true);
    expect(
      result.ok && result.validUntil < new Date('2027-07-27T21:00:00Z'),
    ).toBe(true);
  });

  test('refuses a missing event or one more than a year ahead', () => {
    expect(walletCardValidity(undefined, now).ok).toBe(false);
    expect(
      walletCardValidity(
        {name: 'Kult 2028', end: new Date('2028-07-23T21:00:00Z')},
        now,
      ).ok,
    ).toBe(false);
  });
});

test('a wallet card link decodes like a physical card link', () => {
  vi.stubEnv('CONTACTLESS_SALT', 'salt');
  const cardId = new Uint8Array([0x53, 1, 2, 3, 4, 5, 6]);
  const {validUntilEpoch, validUntil} = walletCardValidity(
    {name: 'Kult 2027', end: new Date('2027-07-25T21:00:00Z')},
    now,
  ) as {validUntilEpoch: number; validUntil: Date};

  const decoded = decodePayload(
    'crewcard',
    encodeCrewCardPayload(cardId, validUntilEpoch),
  );
  expect(decoded).toEqual({
    type: 'crewcard',
    cardId: '53010203040506',
    validUntil,
  });
});
