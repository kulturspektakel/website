import {describe, expect, it} from 'vitest';
import {NoiseRecording} from '../../proto/noise';
import {
  LIVE_LEVEL_WINDOW_MS,
  POINT_METRICS,
  displayedLevel,
  formatDb,
  liveDb,
  loudestLevel,
  metricOptions,
  weightingUnit,
  type DisplayedLevel,
  type LevelMetric,
} from './level';
import {type Weighting} from './noise';

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

// The page's default picker position, so each case names only what it is about.
const shows = (args: {
  live: boolean;
  now: number;
  metric?: LevelMetric;
  weighting?: Weighting;
  state?: ReturnType<typeof state>;
  historyDb?: number | null;
}) => displayedLevel({metric: 'eq_fast', weighting: 'A', ...args});

describe('displayedLevel', () => {
  it('shows the latest MQTT record while live', () => {
    expect(shows({live: true, now: NOW, state: state(87.5, 1_000)})).toEqual({
      kind: 'live',
      db: 87.5,
    });
  });

  // The selected window is what live reads off the record, not just the 1 s value.
  it('reads the selected window off the live record', () => {
    const s = state(87.5, 1_000, 71.5);
    expect(shows({live: true, now: NOW, metric: 'eq_5m', state: s})).toEqual({
      kind: 'live',
      db: 71.5,
    });
  });

  // A trailing window a device hasn't filled yet is absent, not quiet — the same
  // rule the 1 s value gets when the stream dries up.
  it('shows nothing for a window the device cannot report yet', () => {
    expect(
      shows({
        live: true,
        now: NOW,
        metric: 'eq_30m',
        state: state(87.5, 1_000),
      }),
    ).toEqual({kind: 'none'});
  });

  // 'total' is a range aggregate; live has no range. The picker disables it while
  // live, and this is the belt to that braces.
  it('shows nothing for the range Leq while live', () => {
    expect(
      shows({live: true, now: NOW, metric: 'total', state: state(87.5, 1_000)}),
    ).toEqual({kind: 'none'});
  });

  // The point of the 10 s window: a monitor that stopped publishing must not keep
  // showing a number that reads as "right now".
  it('shows nothing when the live stream has dried up', () => {
    expect(shows({live: true, now: NOW, state: state(87.5, 11_000)})).toEqual({
      kind: 'none',
    });
  });

  it('treats the window as exclusive at its edge', () => {
    const justInside = LIVE_LEVEL_WINDOW_MS - 1;
    expect(
      shows({live: true, now: NOW, state: state(80, justInside)}).kind,
    ).toBe('live');
    expect(
      shows({
        live: true,
        now: NOW,
        state: state(80, LIVE_LEVEL_WINDOW_MS),
      }).kind,
    ).toBe('none');
  });

  it('shows nothing when live and the device has never reported', () => {
    expect(shows({live: true, now: NOW})).toEqual({kind: 'none'});
  });

  // With live off the MQTT stream is irrelevant, however fresh it is — otherwise
  // scrubbing to a past instant would silently show the present.
  it('ignores live data when live is off', () => {
    expect(
      shows({
        live: false,
        now: NOW,
        state: state(87.5, 0),
        historyDb: 62.5,
      }),
    ).toEqual({kind: 'history', db: 62.5});

    expect(shows({live: false, now: NOW, state: state(87.5, 0)})).toEqual({
      kind: 'none',
    });
  });

  it('shows nothing when the playhead has no measurement', () => {
    expect(shows({live: false, now: NOW, historyDb: null})).toEqual({
      kind: 'none',
    });
  });

  // 0 dB is a real (if unlikely) reading and must not be mistaken for absent.
  it('does not treat a zero reading as missing', () => {
    expect(shows({live: false, now: NOW, historyDb: 0})).toEqual({
      kind: 'history',
      db: 0,
    });
  });
});

// Every window the picker offers has to resolve for both weightings, or seriesFor's
// assertion is a crash waiting for someone to switch to dB(C).
describe('liveDb', () => {
  const record = {
    laeq: encoded(80),
    lceq: encoded(85),
    laeq5m: encoded(70),
    lceq5m: encoded(75),
    laeq30m: encoded(60),
    lceq30m: encoded(65),
  } as NoiseRecording;

  it('resolves every offered window under both weightings', () => {
    for (const metric of POINT_METRICS) {
      for (const weighting of ['A', 'C'] as const) {
        expect(liveDb(record, metric, weighting)).toBeTypeOf('number');
      }
    }
  });

  it('reads the weighting the caller asked for', () => {
    expect(liveDb(record, 'eq_fast', 'A')).toBe(80);
    expect(liveDb(record, 'eq_fast', 'C')).toBe(85);
    expect(liveDb(record, 'eq_30m', 'C')).toBe(65);
  });

  it('has no answer for the range Leq', () => {
    expect(liveDb(record, 'total', 'A')).toBeNull();
  });
});

describe('metricOptions', () => {
  // The one option whose label depends on the mode: a live record is per-second, a
  // stored row is per-minute, and the user picked "as fine as it gets" either way.
  it('labels the finest window for the mode', () => {
    expect(metricOptions(true)[0]?.label).toBe('Leq,1s');
    expect(metricOptions(false)[0]?.label).toBe('Leq,1m');
  });

  it('offers the range Leq only when not live', () => {
    const range = (live: boolean) =>
      metricOptions(live).find((o) => o.value === 'total');
    expect(range(true)?.disabled).toBe(true);
    expect(range(false)?.disabled).toBe(false);
  });
});

describe('weightingUnit', () => {
  it('spells the weighting out', () => {
    expect(weightingUnit('A')).toBe('dB(A)');
    expect(weightingUnit('C')).toBe('dB(C)');
  });
});

describe('loudestLevel', () => {
  const live = (db: number): DisplayedLevel => ({kind: 'live', db});

  it('picks the loudest of a location’s monitors', () => {
    expect(loudestLevel([live(72.1), live(88.4), live(80)])).toEqual(
      live(88.4),
    );
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
