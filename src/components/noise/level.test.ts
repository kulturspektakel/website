import {describe, expect, it} from 'vitest';
import {NoiseRecording} from '../../proto/noise';
import {
  LIVE_LEVEL_WINDOW_MS,
  displayedLevel,
  formatDb,
  liveDb,
  loudestIndex,
  loudestLevel,
  rangeLabel,
  primarySeries,
  seriesLabel,
  seriesOptions,
  toggledSeries,
  weightingUnit,
  type DisplayedLevel,
  type PickedSeries,
} from './level';
import {
  LIVE_SERIES,
  seriesByKey,
  seriesKey,
  SERIES_KEYS,
  type SeriesKey,
} from './series';

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
  series?: SeriesKey;
  state?: ReturnType<typeof state>;
  historyDb?: number | null;
}) => displayedLevel({series: 'eq_fast:A', ...args});

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
    expect(shows({live: true, now: NOW, series: 'eq_5m:A', state: s})).toEqual({
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
        series: 'eq_30m:A',
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

// Every row the picker offers has to resolve, or seriesByKey's assertion is a crash
// waiting for someone to tick a box.
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

  it('resolves every series the picker offers', () => {
    for (const key of SERIES_KEYS) {
      expect(liveDb(record, key)).toBeTypeOf('number');
    }
  });

  it('reads the weighting named in the key', () => {
    expect(liveDb(record, 'eq_fast:A')).toBe(80);
    expect(liveDb(record, 'eq_fast:C')).toBe(85);
    expect(liveDb(record, 'eq_30m:C')).toBe(65);
    expect(liveDb(record, 'fmax:A')).toBe(90);
    expect(liveDb(record, 'peak:C')).toBe(105);
  });
});

// What a card's tiles print under the number, and what the picker's own rows read — the one
// spelling of a series, and the only thing distinguishing a kind's two weightings anywhere
// they are drawn (they share a colour).
describe('seriesLabel', () => {
  // Derived from the series table rather than spelled again, and this is what says so: a
  // rename in the legend has to land on the cards too, or the same quantity is called two
  // things on one page.
  it('is the chart legend’s own spelling, live', () => {
    for (const series of LIVE_SERIES) {
      expect(seriesLabel(seriesKey(series.kind, series.weighting), true)).toBe(
        series.label,
      );
    }
  });

  // The one name that depends on the mode, for the same reason seriesOptions' does.
  it('names the finest window as a stored minute', () => {
    expect(seriesLabel('eq_fast:A', false)).toBe('LAeq,1m');
    expect(seriesLabel('eq_fast:C', false)).toBe('LCeq,1m');
    // And leaves every other name alone, mode or no mode.
    expect(seriesLabel('fmax:A', false)).toBe('LAFmax');
    expect(seriesLabel('peak:C', false)).toBe('LCpeak');
  });

  // The crop's Leq names the timeframe where a window would be — and carries a weighting
  // like everything else, because it is an energetic mean over one weighting's minute
  // column. Which one follows the primary, so the menu row and the card tile are renamed
  // together by whatever is ticked above them.
  it('names the timeframe where a window would be, weighted', () => {
    expect(rangeLabel('A')).toBe('LAeq,Range');
    expect(rangeLabel('C')).toBe('LCeq,Range');
    expect(
      rangeLabel(seriesByKey(primarySeries(['fmax:C', 'peak:C'])).weighting),
    ).toBe('LCeq,Range');
  });
});

describe('seriesOptions', () => {
  // Two blocks headed by their unit, A first, and every series there is — nine rows, not a
  // weighting's five, because the weighting is part of what is picked now rather than a mode
  // beside the picking. Nothing is disabled: the pair that doesn't exist (LApeak) is simply
  // not a row.
  it('is every series, in two blocks headed by their unit', () => {
    expect(
      seriesOptions(false).map(({unit, options}) => [
        unit,
        options.map((o) => o.label),
      ]),
    ).toEqual([
      ['dB(A)', ['LAeq,1m', 'LAeq,5m', 'LAeq,30m', 'LAFmax']],
      ['dB(C)', ['LCeq,1m', 'LCeq,5m', 'LCeq,30m', 'LCFmax', 'LCpeak']],
    ]);
  });

  // The one label that depends on the mode: a live record is per-second, a stored row is
  // per-minute, and the user picked "as fine as it gets" either way.
  it('labels the finest window for the mode', () => {
    expect(seriesOptions(true)[0]?.options[0]?.label).toBe('LAeq,1s');
    expect(seriesOptions(false)[0]?.options[0]?.label).toBe('LAeq,1m');
  });
});

// The picked set, and the two rules that keep it usable: it is in SERIES_KEYS order whatever
// order it was pressed in, and it is never empty. The refusal hands back the very array it
// was given — a fresh one would be a new context value for every card on the project page
// and a rebuilt uPlot behind each of them, so the identity is part of the contract rather
// than an implementation detail.
describe('toggledSeries', () => {
  it('adds in the table\u2019s order, not the order pressed', () => {
    expect(toggledSeries(['eq_30m:A'], 'eq_fast:A')).toEqual([
      'eq_fast:A',
      'eq_30m:A',
    ]);
    // And the table's order puts every A-weighted row above every C-weighted one, which is
    // what makes the primary of a mixed pick the A-weighted one.
    expect(toggledSeries(['eq_fast:C'], 'fmax:A')).toEqual([
      'fmax:A',
      'eq_fast:C',
    ]);
  });

  it('removes one that was already picked', () => {
    expect(
      toggledSeries(['eq_fast:A', 'eq_5m:A', 'eq_5m:C'], 'eq_5m:A'),
    ).toEqual(['eq_fast:A', 'eq_5m:C']);
  });

  // A chart of nothing is not a state the page has anything to say in.
  it('refuses to remove the last, and says so by identity', () => {
    const only: PickedSeries = ['eq_5m:A'];
    expect(toggledSeries(only, 'eq_5m:A')).toBe(only);
  });
});

describe('primarySeries', () => {
  // The table is A-block-first and finest-first within each, so the primary of a pick is
  // the finest A-weighted thing in it — and only a pick with no A-weighted row at all reads
  // in dB(C). Which is what decides the map pin and the weighting of the crop's Leq.
  it('is the first of the set in table order', () => {
    expect(primarySeries(['eq_5m:A', 'fmax:C'])).toBe('eq_5m:A');
    expect(primarySeries(['fmax:C', 'peak:C'])).toBe('fmax:C');
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
