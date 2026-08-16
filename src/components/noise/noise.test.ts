import {describe, expect, it} from 'vitest';
import {
  ACTIVE_WINDOW_MS,
  decodeDb,
  formatLastSeen,
  isFresh,
  lastSeenAt,
} from './noise';

describe('decodeDb', () => {
  // The device sends (dB - 20) * 2 in one byte. The history query decodes the
  // same thing in SQL — `(20 + laeq / 2.0)::float8`, nine times over in
  // noiseHistory.server.ts — because it does it for 1440 rows × 10 columns per
  // day. Two implementations of one encoding, so the endpoints are pinned here:
  // if this test changes, that SQL has to change with it.
  it('maps the byte range onto 20…147.5 dB', () => {
    expect(decodeDb(0)).toBe(20);
    expect(decodeDb(255)).toBe(147.5);
  });

  it('resolves to half a decibel', () => {
    expect(decodeDb(1)).toBe(20.5);
    expect(decodeDb(140)).toBe(90);
  });
});

describe('isFresh', () => {
  const NOW = 1_000_000;

  it('is false for a device never seen', () => {
    expect(isFresh(undefined, NOW)).toBe(false);
  });

  it('is true within the active window', () => {
    expect(isFresh(NOW - 1, NOW)).toBe(true);
    expect(isFresh(NOW - (ACTIVE_WINDOW_MS - 1), NOW)).toBe(true);
  });

  // Exclusive at the edge, so a device exactly one window old reads as gone
  // rather than flickering between states on the 1 Hz tick.
  it('is false at and beyond the window edge', () => {
    expect(isFresh(NOW - ACTIVE_WINDOW_MS, NOW)).toBe(false);
    expect(isFresh(NOW - ACTIVE_WINDOW_MS - 1, NOW)).toBe(false);
  });

  it('honours a caller-supplied window', () => {
    expect(isFresh(NOW - 8_000, NOW)).toBe(false);
    expect(isFresh(NOW - 8_000, NOW, 10_000)).toBe(true);
  });

  // A device whose clock runs ahead reports a future lastSeen; that is still
  // "recently heard from", not stale.
  it('treats a future timestamp as fresh', () => {
    expect(isFresh(NOW + 1_000, NOW)).toBe(true);
  });
});

describe('lastSeenAt', () => {
  // Two sources, and the rule is "whichever is later" — a page opened this morning knows
  // last night from the record, and a monitor still transmitting is only in the live store.
  it('takes the later of the record and the live store', () => {
    expect(lastSeenAt(100, 200)).toBe(200);
    expect(lastSeenAt(300, 200)).toBe(300);
  });

  it('falls back to whichever source knows anything', () => {
    expect(lastSeenAt(null, 200)).toBe(200);
    expect(lastSeenAt(100, undefined)).toBe(100);
  });

  // Undefined and not 0: "never heard from" is a different statement from "heard from at
  // the epoch", and every caller prints the two differently.
  it('is undefined when nothing has ever heard from it', () => {
    expect(lastSeenAt()).toBeUndefined();
    expect(lastSeenAt(null, undefined)).toBeUndefined();
  });

  // A location asks the question of its whole set at once, so the answer is the newest of
  // every monitor's every source.
  it('answers for a whole set of monitors', () => {
    expect(lastSeenAt(100, undefined, null, 500, 300)).toBe(500);
  });
});

describe('formatLastSeen', () => {
  const NOW = Date.parse('2026-08-06T12:00:00Z');
  const ago = (ms: number) => formatLastSeen(NOW - ms, NOW);

  it('escalates through seconds, minutes, hours and days', () => {
    expect(ago(5_000)).toBe('5 seconds ago');
    expect(ago(5 * 60_000)).toBe('5 minutes ago');
    expect(ago(3 * 3_600_000)).toBe('3 hours ago');
    expect(ago(3 * 86_400_000)).toBe('3 days ago');
  });

  // numeric: 'auto', so the nearest units reach for words before numbers. English has
  // only the two — no 'vorgestern' — which is the day the counting starts again.
  it('uses words for the nearest units', () => {
    expect(ago(0)).toBe('now');
    expect(ago(86_400_000)).toBe('yesterday');
    expect(ago(2 * 86_400_000)).toBe('2 days ago');
  });
});
