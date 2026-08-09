import {describe, expect, it} from 'vitest';
import {
  HISTORY_SERIES,
  LIVE_SERIES,
  SERIES,
  alignedBuffers,
  alignedSeries,
  emptyBuffer,
  loudestColumn,
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
      expect([a!.stroke, a!.hidden ?? false]).toEqual([
        c.stroke,
        c.hidden ?? false,
      ]);
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

describe('emptyBuffer', () => {
  // The live view renders this until the device's first record arrives, so it
  // has to be the same width as the buffer ingest goes on to fill — otherwise
  // the chart binds its lines to the wrong columns for one frame.
  it('matches the live buffer width', () => {
    const buffer = emptyBuffer();
    expect(buffer).toHaveLength(SERIES.length + 1);
    expect(buffer.every((col) => col.length === 0)).toBe(true);
  });

  it('is a fresh array each call, never a shared one', () => {
    const a = emptyBuffer();
    a[0]!.push(1);
    expect(emptyBuffer()[0]).toEqual([]);
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
    const aligned = rowsToAligned([
      {...emptyRow(), minute_epoch: 1, laeq_1m: 70},
    ]);
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

describe('alignedSeries', () => {
  // logSeries hands every device the same xs array; this leans on that, so it is
  // pinned here rather than trusted.
  it('shares one x column and keeps the devices in order', () => {
    const xs = [60, 120, 180];
    expect(
      alignedSeries([
        {xs, db: [70, null, 72]},
        {xs, db: [80, 81, 82]},
      ]),
    ).toEqual([xs, [70, null, 72], [80, 81, 82]]);
  });

  it('pads a device with no trace to the shared grid', () => {
    const xs = [60, 120];
    expect(alignedSeries([undefined, {xs, db: [80, 81]}])).toEqual([
      xs,
      [null, null],
      [80, 81],
    ]);
  });

  it('is empty columns when nothing has loaded', () => {
    expect(alignedSeries([undefined, undefined])).toEqual([[], [], []]);
  });
});

describe('alignedBuffers', () => {
  // Column 1 under the default weighting is LAeq; the tests build buffers by hand
  // rather than through ingest, so the column index is spelled out.
  const buffer = (times: number[], values: (number | null)[]) => {
    const b = emptyBuffer();
    b[0] = times;
    b[1] = values;
    return b;
  };

  it('hands a lone device its own columns, untouched', () => {
    const only = buffer([1, 2, 3], [70, 71, 72]);
    const aligned = alignedBuffers([only], 1);
    expect(aligned).toEqual([
      [1, 2, 3],
      [70, 71, 72],
    ]);
    // The same arrays, not copies: this runs once a second per chart.
    expect(aligned[0]).toBe(only[0]);
  });

  it('is empty columns for a device that has never reported', () => {
    expect(alignedBuffers([undefined], 1)).toEqual([[], []]);
  });

  it('merges interleaved timestamps and nulls each device elsewhere', () => {
    expect(
      alignedBuffers([buffer([1, 3], [70, 72]), buffer([2, 3.5], [80, 81])], 1),
    ).toEqual([
      [1, 2, 3, 3.5],
      [70, null, 72, null],
      [null, 80, null, 81],
    ]);
  });

  it('lets two devices share a timestamp they both reported at', () => {
    expect(
      alignedBuffers([buffer([1, 2], [70, 71]), buffer([2], [80])], 1),
    ).toEqual([
      [1, 2],
      [70, 71],
      [null, 80],
    ]);
  });

  it('pads a device with no buffer alongside one that has samples', () => {
    expect(alignedBuffers([undefined, buffer([1, 2], [80, 81])], 1)).toEqual([
      [1, 2],
      [null, null],
      [80, 81],
    ]);
  });
});

describe('loudestColumn', () => {
  // The stored case: every monitor has a value at every minute it was up, so this is
  // the plain pointwise maximum.
  it('takes the loudest at each x', () => {
    expect(
      loudestColumn(
        [60, 120, 180],
        [
          [70, 85, 72],
          [80, 81, 82],
        ],
        90,
      ),
    ).toEqual([80, 85, 82]);
  });

  // The live case, and the reason for the hold: the two monitors' messages land at
  // different instants, so at every x exactly one column has a value. Without carrying
  // the other's last reading this would sawtooth between them.
  it('holds a monitor at its last reading between its samples', () => {
    expect(
      loudestColumn(
        [1, 2, 3, 4],
        [
          [90, null, 90, null],
          [null, 70, null, 70],
        ],
        3,
      ),
    ).toEqual([90, 90, 90, 90]);
  });

  it('drops a monitor that has been silent longer than the hold', () => {
    expect(
      loudestColumn(
        [1, 2, 10],
        [
          [90, null, null],
          [null, 70, 70],
        ],
        3,
      ),
    ).toEqual([90, 90, 70]);
  });

  it('is null where no monitor has said anything yet', () => {
    expect(loudestColumn([1, 2], [[null, 80]], 3)).toEqual([null, 80]);
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
