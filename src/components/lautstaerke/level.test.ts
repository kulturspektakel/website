import {describe, expect, it} from 'vitest';
import {NoiseRecording} from '../../proto/noise';
import {
  LIVE_LEVEL_WINDOW_MS,
  displayedLevel,
  formatDb,
  loudestLevel,
  type DisplayedLevel,
} from './level';

const NOW = Date.parse('2026-07-25T20:00:00Z');

// Levels come off the wire encoded as (dB - 20) * 2, so 87.5 dB is byte 135.
const encoded = (db: number) => (db - 20) * 2;

const state = (db: number, ageMs: number, laeq5m?: number) => ({
  lastSeen: NOW - ageMs,
  latest: {
    laeq: encoded(db),
    laeq5m: laeq5m == null ? undefined : encoded(laeq5m),
  } as NoiseRecording,
});

describe('displayedLevel', () => {
  it('shows the latest MQTT record while live', () => {
    expect(displayedLevel({live: true, now: NOW, state: state(87.5, 1_000)})).toEqual(
      {kind: 'live', db: 87.5},
    );
  });

  // The point of the 10 s window: a monitor that stopped publishing must not keep
  // showing a number that reads as "right now".
  it('shows nothing when the live stream has dried up', () => {
    expect(
      displayedLevel({live: true, now: NOW, state: state(87.5, 11_000)}),
    ).toEqual({kind: 'none'});
  });

  it('treats the window as exclusive at its edge', () => {
    const justInside = LIVE_LEVEL_WINDOW_MS - 1;
    expect(
      displayedLevel({live: true, now: NOW, state: state(80, justInside)}).kind,
    ).toBe('live');
    expect(
      displayedLevel({
        live: true,
        now: NOW,
        state: state(80, LIVE_LEVEL_WINDOW_MS),
      }).kind,
    ).toBe('none');
  });

  it('shows nothing when live and the device has never reported', () => {
    expect(displayedLevel({live: true, now: NOW})).toEqual({kind: 'none'});
  });

  // With live off the MQTT stream is irrelevant, however fresh it is — otherwise
  // scrubbing to a past instant would silently show the present.
  it('ignores live data when live is off', () => {
    expect(
      displayedLevel({
        live: false,
        now: NOW,
        state: state(87.5, 0),
        historyDb: 62.5,
      }),
    ).toEqual({kind: 'history', db: 62.5});

    expect(
      displayedLevel({live: false, now: NOW, state: state(87.5, 0)}),
    ).toEqual({kind: 'none'});
  });

  it('shows nothing when the playhead has no measurement', () => {
    expect(
      displayedLevel({live: false, now: NOW, historyDb: null}),
    ).toEqual({kind: 'none'});
  });

  // 0 dB is a real (if unlikely) reading and must not be mistaken for absent.
  it('does not treat a zero reading as missing', () => {
    expect(displayedLevel({live: false, now: NOW, historyDb: 0})).toEqual({
      kind: 'history',
      db: 0,
    });
  });
});

describe('loudestLevel', () => {
  const live = (db: number): DisplayedLevel => ({kind: 'live', db});

  it('picks the loudest of a location’s monitors', () => {
    expect(loudestLevel([live(72.1), live(88.4), live(80)])).toEqual(live(88.4));
  });

  it('skips monitors with nothing to show', () => {
    expect(loudestLevel([{kind: 'none'}, live(72.1), {kind: 'none'}])).toEqual(
      live(72.1),
    );
  });

  it('is none when no monitor has a level', () => {
    expect(loudestLevel([{kind: 'none'}, {kind: 'none'}])).toEqual({
      kind: 'none',
    });
    expect(loudestLevel([])).toEqual({kind: 'none'});
  });
});

describe('formatDb', () => {
  it('renders a dash for a missing level, never a zero', () => {
    expect(formatDb(null)).toBe('—');
    expect(formatDb(null, 'dB(A)')).toBe('—');
    expect(formatDb(0)).toBe('0.0');
  });

  it('appends a unit when given one', () => {
    expect(formatDb(87.25, 'dB(A)')).toBe('87.3 dB(A)');
  });

  it('always shows one decimal, so pins and rows agree', () => {
    expect(formatDb(87)).toBe('87.0');
    expect(formatDb(87.25)).toBe('87.3');
  });
});
