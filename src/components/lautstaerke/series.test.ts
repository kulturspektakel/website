import {describe, expect, it} from 'vitest';
import {
  HISTORY_SERIES,
  LIVE_SERIES,
  SERIES,
  rowsToAligned,
  type SeriesKind,
} from './series';
import {type HistoryRow} from './noise';

// SERIES replaced two hand-maintained nine-entry tables, and the things that
// used to keep them honest — matching them up by eye — are gone. Everything the
// type system can't see about that table is pinned here: the order (which is
// the chart's column order), the pairing of the two label sets, and the fact
// that every history column is plotted exactly once.

describe('SERIES', () => {
  it('pairs each kind across both weightings, A first', () => {
    expect(SERIES.map((s) => `${s.weighting}:${s.kind}`)).toEqual([
      'A:eq_fast',
      'A:eq_5m',
      'A:eq_30m',
      'A:fmax',
      'C:eq_fast',
      'C:eq_5m',
      'C:eq_30m',
      'C:fmax',
      'C:peak',
    ]);
  });

  it('has one entry per (kind, weighting)', () => {
    const seen = SERIES.map((s) => `${s.weighting}:${s.kind}`);
    expect(new Set(seen).size).toBe(SERIES.length);
  });

  // The legend toggle is keyed by kind alone, so the A and C entries of one kind
  // must agree on everything the toggle and the chart read from them. If they
  // drift, hiding LAFmax would leave LCFmax on the chart.
  it('gives both weightings of a kind the same stroke and default visibility', () => {
    for (const kind of new Set(SERIES.map((s) => s.kind))) {
      const [a, c] = SERIES.filter((s) => s.kind === kind);
      if (!c) continue; // 'peak' is C-only.
      expect([a!.stroke, a!.hidden ?? false]).toEqual([c.stroke, c.hidden ?? false]);
    }
  });

  it('reads every history column exactly once', () => {
    const cols = SERIES.map((s) => s.col);
    expect(new Set(cols).size).toBe(cols.length);
    expect(cols).not.toContain('minute_epoch');

    // Every field of a row except the timestamp should be plotted; a column
    // added to the query and not to the table would otherwise never show up.
    const row = emptyRow();
    const plotted = new Set<string>(cols);
    const unplotted = Object.keys(row).filter(
      (k) => k !== 'minute_epoch' && !plotted.has(k),
    );
    expect(unplotted).toEqual([]);
  });
});

describe('LIVE_SERIES / HISTORY_SERIES', () => {
  // The two differ only in the fast window's label — that is the entire reason
  // they can be one table.
  it('agree on order, kind, weighting, stroke and visibility', () => {
    const shape = (s: (typeof LIVE_SERIES)[number]) => [
      s.kind,
      s.weighting,
      s.stroke,
      s.hidden ?? false,
    ];
    expect(LIVE_SERIES.map(shape)).toEqual(HISTORY_SERIES.map(shape));
  });

  // Pinned verbatim: these strings are the chart legend and the big-number
  // labels, so a rename here is a visible product change, not a refactor.
  it('label the live view per second and the history view per minute', () => {
    expect(LIVE_SERIES.map((s) => s.label)).toEqual([
      'LAeq,1s',
      'LAeq,5m',
      'LAeq,30m',
      'LAFmax',
      'LCeq,1s',
      'LCeq,5m',
      'LCeq,30m',
      'LCFmax',
      'LCpeak',
    ]);
    expect(HISTORY_SERIES.map((s) => s.label)).toEqual([
      'LAeq,1m',
      'LAeq,5m',
      'LAeq,30m',
      'LAFmax',
      'LCeq,1m',
      'LCeq,5m',
      'LCeq,30m',
      'LCFmax',
      'LCpeak',
    ]);
  });

  it('hides the max and peak lines by default, shows the Leqs', () => {
    const hidden = new Set<SeriesKind>(
      SERIES.filter((s) => s.hidden).map((s) => s.kind),
    );
    expect([...hidden].sort()).toEqual(['fmax', 'peak']);
  });
});

describe('rowsToAligned', () => {
  // The chart reads column i+1 as SERIES[i], and nothing in the type system
  // says so. This is that contract.
  it('emits the timestamp column then one column per series, in order', () => {
    const row = {...emptyRow(), minute_epoch: 100};
    for (const [i, s] of SERIES.entries()) {
      (row as Record<string, number | null>)[s.col] = i;
    }

    const aligned = rowsToAligned([row]);

    expect(aligned).toHaveLength(SERIES.length + 1);
    expect(aligned[0]).toEqual([100]);
    expect(aligned.slice(1).map((col) => col[0])).toEqual(
      SERIES.map((_, i) => i),
    );
  });

  it('preserves nulls rather than dropping the sample', () => {
    // A minute present in the query but missing its 5m/30m windows breaks just
    // those lines; it must not shorten the columns or shift the others.
    const aligned = rowsToAligned([{...emptyRow(), minute_epoch: 1, laeq_1m: 70}]);
    expect(aligned.every((col) => col.length === 1)).toBe(true);
    const laeq5m = SERIES.findIndex((s) => s.col === 'laeq_5m');
    expect(aligned[laeq5m + 1]![0]).toBeNull();
  });

  it('returns empty columns for no rows', () => {
    expect(rowsToAligned([])).toEqual(
      Array.from({length: SERIES.length + 1}, () => []),
    );
  });
});

// Every HistoryRow field, so the "is anything unplotted" check above stays
// honest when a column is added to the query.
function emptyRow(): HistoryRow {
  return {
    minute_epoch: 0,
    laeq_1m: 0,
    laeq_5m: null,
    laeq_30m: null,
    lafmax: 0,
    lceq_1m: 0,
    lceq_5m: null,
    lceq_30m: null,
    lcfmax: 0,
    lcpeak: 0,
  };
}
