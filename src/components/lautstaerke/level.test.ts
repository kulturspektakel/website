import {describe, expect, it} from 'vitest';
import {NoiseRecording} from '../../proto/noise';
import {
  LEVEL_METRICS,
  LIVE_LEVEL_WINDOW_MS,
  displayedLevel,
  formatDb,
  liveDb,
  loudestIndex,
  loudestLevel,
  metricLabel,
  metricOptions,
  rangeLabel,
  primaryMetric,
  supportedMetric,
  supportedMetrics,
  toggledMetrics,
  weightingUnit,
  type DisplayedLevel,
  type LevelMetric,
  type PickedMetrics,
} from './level';
import {type Weighting} from './noise';
import {LIVE_SERIES} from './series';

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

  // The point of the 10 s window: a monitor that stopped publishing keeps its last
  // number, but that number must no longer read as "right now".
  it('keeps the last value as stale when the live stream has dried up', () => {
    expect(shows({live: true, now: NOW, state: state(87.5, 11_000)})).toEqual({
      kind: 'stale',
      db: 87.5,
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
    ).toBe('stale');
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

// Every combination the picker leaves enabled has to resolve, or seriesFor's
// assertion is a crash waiting for someone to switch weighting.
describe('liveDb', () => {
  const record = {
    laeq: encoded(80),
    lceq: encoded(85),
    laeq5m: encoded(70),
    lceq5m: encoded(75),
    laeq30m: encoded(60),
    lceq30m: encoded(65),
    lafmax: encoded(90),
    lcfmax: encoded(95),
    lcpeak: encoded(105),
  } as NoiseRecording;

  it('resolves every enabled option under both weightings', () => {
    for (const metric of LEVEL_METRICS) {
      for (const weighting of ['A', 'C'] as const) {
        if (supportedMetric(metric, weighting) !== metric) continue;
        expect(liveDb(record, metric, weighting)).toBeTypeOf('number');
      }
    }
  });

  it('reads the weighting the caller asked for', () => {
    expect(liveDb(record, 'eq_fast', 'A')).toBe(80);
    expect(liveDb(record, 'eq_fast', 'C')).toBe(85);
    expect(liveDb(record, 'eq_30m', 'C')).toBe(65);
    expect(liveDb(record, 'fmax', 'A')).toBe(90);
    expect(liveDb(record, 'peak', 'C')).toBe(105);
  });
});

// What a card's tiles print under the number, where the picker's labels leave the weighting
// to the other dropdown and these have to carry it (see LocationReadings).
describe('metricLabel', () => {
  // Derived from the series table rather than spelled again, and this is what says so: a
  // rename in the legend has to land on the cards too, or the same quantity is called two
  // things on one page.
  it('is the chart legend’s own spelling, live', () => {
    for (const series of LIVE_SERIES) {
      expect(metricLabel(series.kind, series.weighting, true)).toBe(
        series.label,
      );
    }
  });

  // The one name that depends on the mode, for the same reason metricOptions' does.
  it('names the finest window as a stored minute', () => {
    expect(metricLabel('eq_fast', 'A', false)).toBe('LAeq,1m');
    expect(metricLabel('eq_fast', 'C', false)).toBe('LCeq,1m');
    // And leaves every other name alone, mode or no mode.
    expect(metricLabel('fmax', 'A', false)).toBe('LAFmax');
    expect(metricLabel('peak', 'C', false)).toBe('LCpeak');
  });

  it('names the timeframe where a window would be', () => {
    expect(rangeLabel('A')).toBe('LAeq,Zeitraum');
  });
});

describe('metricOptions', () => {
  // The one option whose label depends on the mode: a live record is per-second, a
  // stored row is per-minute, and the user picked "as fine as it gets" either way.
  it('labels the finest window for the mode', () => {
    expect(metricOptions(true, 'A')[0]?.label).toBe('Leq,1s');
    expect(metricOptions(false, 'A')[0]?.label).toBe('Leq,1m');
  });

  // The mode never disables anything: the Leq over the timeframe, the one thing live
  // had no answer for, is shown on the rows themselves and is not picked here.
  it('offers every series in either mode', () => {
    for (const live of [true, false]) {
      expect(metricOptions(live, 'C').map((o) => o.label)).toEqual([
        live ? 'Leq,1s' : 'Leq,1m',
        'Leq,5m',
        'Leq,30m',
        'Fmax',
        'Peak',
      ]);
    }
  });

  // The weighting does: a peak is C-weighted by definition, so under dB(A) it is
  // offered and greyed out rather than quietly missing.
  it('disables what the weighting has no series for', () => {
    const disabled = (weighting: Weighting) =>
      metricOptions(false, weighting)
        .filter((o) => o.disabled)
        .map((o) => o.value);
    expect(disabled('A')).toEqual(['peak']);
    expect(disabled('C')).toEqual([]);
  });
});

describe('supportedMetric', () => {
  it('keeps a pick the weighting can answer', () => {
    expect(supportedMetric('eq_5m', 'A')).toBe('eq_5m');
    expect(supportedMetric('peak', 'C')).toBe('peak');
  });

  // Peaks are maxima, so dB(A)'s answer to them is LAFmax — not the page default.
  it('falls back to the nearest kin when it cannot', () => {
    expect(supportedMetric('peak', 'A')).toBe('fmax');
  });
});

// The picked set, and the two rules that keep it usable: it is in LEVEL_METRICS order
// whatever order it was pressed in, and it is never empty. Both helpers hand back the very
// array they were given where nothing changed — a fresh one would be a new context value for
// every card on the project page and a rebuilt uPlot behind each of them, so the identity is
// part of the contract rather than an implementation detail.
describe('toggledMetrics', () => {
  it('adds in the table’s order, not the order pressed', () => {
    expect(toggledMetrics(['eq_30m'], 'eq_fast')).toEqual([
      'eq_fast',
      'eq_30m',
    ]);
    expect(toggledMetrics(['eq_fast', 'fmax'], 'eq_5m')).toEqual([
      'eq_fast',
      'eq_5m',
      'fmax',
    ]);
  });

  it('removes one that was already picked', () => {
    expect(toggledMetrics(['eq_fast', 'eq_5m', 'fmax'], 'eq_5m')).toEqual([
      'eq_fast',
      'fmax',
    ]);
  });

  // A chart of nothing is not a state the page has anything to say in.
  it('refuses to remove the last, and says so by identity', () => {
    const only: PickedMetrics = ['eq_5m'];
    expect(toggledMetrics(only, 'eq_5m')).toBe(only);
  });
});

describe('supportedMetrics', () => {
  it('is untouched, and the same array, where the weighting answers all of it', () => {
    const picked: PickedMetrics = ['eq_fast', 'fmax'];
    expect(supportedMetrics(picked, 'A')).toBe(picked);
    expect(supportedMetrics(picked, 'C')).toBe(picked);
  });

  // The one pair that doesn't exist. What was asked for besides it is still drawable, so
  // that is what is kept — nothing falls back.
  it('drops what the weighting has no series for', () => {
    expect(supportedMetrics(['eq_fast', 'peak'], 'A')).toEqual(['eq_fast']);
  });

  // Only when dropping would leave nothing does the nearest kin stand in — the
  // single-metric rule, reached through the same function.
  it('falls back to the nearest kin rather than emptying the set', () => {
    expect(supportedMetrics(['peak'], 'A')).toEqual(['fmax']);
  });
});

describe('primaryMetric', () => {
  // LEVEL_METRICS is finest-first, so the primary is the finest thing picked: adding a
  // coarser line leaves every number on the page where it was.
  it('is the first of the set', () => {
    expect(primaryMetric(['eq_5m', 'fmax'])).toBe('eq_5m');
    expect(primaryMetric(['fmax'])).toBe('fmax');
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

  // One monitor still reporting is what the location is doing now, however loud
  // another one was before it went quiet.
  it('prefers a current reading over a louder stale one', () => {
    const stale: DisplayedLevel = {kind: 'stale', db: 95};
    expect(loudestLevel([stale, live(72.1)])).toEqual(live(72.1));
    expect(loudestLevel([live(72.1), stale])).toEqual(live(72.1));
  });

  it('falls back to the loudest stale value when none are current', () => {
    expect(
      loudestLevel([
        {kind: 'stale', db: 70},
        {kind: 'stale', db: 84.2},
      ]),
    ).toEqual({kind: 'stale', db: 84.2});
  });

  // The list row needs the winner itself, not just its dB: the coverage and the
  // second reading it prints have to come off that same monitor.
  it('names which monitor it was, and -1 for none', () => {
    expect(loudestIndex([live(72.1), live(88.4), live(80)])).toBe(1);
    expect(loudestIndex([{kind: 'stale', db: 95}, live(72.1)])).toBe(1);
    expect(loudestIndex([{kind: 'none'}, {kind: 'none'}])).toBe(-1);
    expect(loudestIndex([])).toBe(-1);
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
