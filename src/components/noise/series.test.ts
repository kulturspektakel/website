import {describe, expect, it} from 'vitest';
import {
  LIVE_SERIES,
  SERIES,
  SERIES_KEYS,
  alignedBuffers,
  alignedSeries,
  bufferColumn,
  emptyBuffer,
  loudestColumn,
  maskToWindows,
  seriesByKey,
  seriesKey,
  traceColumn,
  traceData,
  type SeriesKind,
} from './series';
import {type HistoryRow} from './noise';
import {LEVEL_METRICS} from './level';

// SERIES replaced two hand-maintained nine-entry tables, and the things that used to keep
// them honest — matching them up by eye — are gone. Everything the type system can't see
// about that table is pinned here: the order (which is the chart's column order), the
// labels, and the fact that every stored column is plotted exactly once.

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

  // The names the pages pick by, and the two things they have to promise: that a key names
  // exactly the row it was built from — seriesByKey asserts totality, so a key that missed
  // would be a crash the moment someone ticked it — and that a key's buffer column is the
  // row's own position, the +1 convention emptyBuffer lays down. Both are read on every
  // frame of a live chart, and neither is anything the type system can see.
  it('names every row, and names it back to its own buffer column', () => {
    expect(SERIES_KEYS).toHaveLength(SERIES.length);
    expect(new Set(SERIES_KEYS).size).toBe(SERIES.length);
    SERIES.forEach((s, i) => {
      const key = seriesKey(s.kind, s.weighting);
      expect(SERIES_KEYS[i]).toBe(key);
      expect(seriesByKey(key)).toBe(s);
      expect(bufferColumn(key)).toBe(i + 1);
    });
  });

  // One list, four uses: the picker's rows, the device page's tiles, the chart's column
  // blocks, and — being finest-first — which of a picked set the numbers are read in. All
  // four are this order, so a kind added here without being added there would be a series
  // nothing can pick and a tile nothing lights.
  it('is the same kinds, in the same order, as LEVEL_METRICS', () => {
    expect([...new Set(SERIES.map((s) => s.kind))]).toEqual([...LEVEL_METRICS]);
  });

  // A kind's two weightings are one measurement under a different filter, so they are one
  // colour: what a shade says on a chart is which quantity, and the name beside it says
  // which filter. Since both can now be drawn at once, this is also what makes the labels
  // load-bearing — two lines of one shade are told apart by the tooltip, not the ink.
  //
  // The colour is derived from the kind, so this holds by construction rather than by two
  // rows being kept in step. Kept as the guard against someone reintroducing a per-row
  // value — which is how the two used to be able to drift.
  it('gives both weightings of a kind the same colour', () => {
    for (const kind of new Set(SERIES.map((s) => s.kind))) {
      const [a, c] = SERIES.filter((s) => s.kind === kind);
      expect(a!.color).toBe(`chart.series.${kind}`);
      if (!c) continue; // 'peak' is C-only.
      expect(a!.color).toBe(c.color);
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

describe('LIVE_SERIES', () => {
  // Pinned verbatim: these strings are the chart legend and the big-number
  // labels, so a rename here is a visible product change, not a refactor.
  it('labels every window per second', () => {
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
  });

  // The table is the plot's column order, so a resolved list has to be the table in
  // the table's order — the aligned buffers are index-coupled to it.
  it('is the table, in order', () => {
    expect(LIVE_SERIES.map((s) => s.kind)).toEqual(SERIES.map((s) => s.kind));
    expect(LIVE_SERIES.map((s) => s.color)).toEqual(SERIES.map((s) => s.color));
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

// One group per picked window, each holding one entry per device — and the columns come
// back in that order, window by window (see traceColumn).
describe('alignedSeries', () => {
  // logSeries hands every device of every window the same xs array; this leans on that, so
  // it is pinned here rather than trusted.
  it('shares one x column and keeps the devices in order', () => {
    const xs = [60, 120, 180];
    expect(
      alignedSeries([
        [
          {xs, db: [70, null, 72]},
          {xs, db: [80, 81, 82]},
        ],
      ]),
    ).toEqual([xs, [70, null, 72], [80, 81, 82]]);
  });

  // The layout the whole chart is indexed by: every device of the first window, then every
  // device of the second.
  it('lays several windows out one block each, window-major', () => {
    const xs = [60, 120];
    expect(
      alignedSeries([
        [
          {xs, db: [70, 71]},
          {xs, db: [80, 81]},
        ],
        [
          {xs, db: [60, 61]},
          {xs, db: [65, 66]},
        ],
      ]),
    ).toEqual([xs, [70, 71], [80, 81], [60, 61], [65, 66]]);
  });

  it('pads a device with no trace to the shared grid', () => {
    const xs = [60, 120];
    expect(alignedSeries([[undefined, {xs, db: [80, 81]}]])).toEqual([
      xs,
      [null, null],
      [80, 81],
    ]);
  });

  // A window the payload never carried at all, beside one it did: padded like any other
  // missing trace, so the block is still there for uPlot to have a series for.
  it('pads a whole window the payload has nothing for', () => {
    const xs = [60, 120];
    expect(alignedSeries([[{xs, db: [80, 81]}], [undefined]])).toEqual([
      xs,
      [80, 81],
      [null, null],
    ]);
  });

  it('is empty columns when nothing has loaded', () => {
    expect(alignedSeries([[undefined, undefined]])).toEqual([[], [], []]);
  });
});

// One buffer column per picked window, in the chart's window order (bufferColumn resolves
// them), and the same block layout out as alignedSeries above.
describe('alignedBuffers', () => {
  // Column 1 under the default weighting is LAeq and column 2 is LAeq,5m; the tests build
  // buffers by hand rather than through ingest, so the column indices are spelled out.
  const buffer = (
    times: number[],
    values: (number | null)[],
    fives?: (number | null)[],
  ) => {
    const b = emptyBuffer();
    b[0] = times;
    b[1] = values;
    if (fives) b[2] = fives;
    return b;
  };

  it('hands a lone device its own columns, untouched', () => {
    const only = buffer([1, 2, 3], [70, 71, 72]);
    const aligned = alignedBuffers([only], [1]);
    expect(aligned).toEqual([
      [1, 2, 3],
      [70, 71, 72],
    ]);
    // The same arrays, not copies: this runs once a second per chart.
    expect(aligned[0]).toBe(only[0]);
  });

  // The fast path with several windows: still no copying, one column each in the order
  // asked for.
  it('hands a lone device one column per window, untouched', () => {
    const only = buffer([1, 2], [70, 71], [65, 66]);
    const aligned = alignedBuffers([only], [1, 2]);
    expect(aligned).toEqual([
      [1, 2],
      [70, 71],
      [65, 66],
    ]);
    expect(aligned[0]).toBe(only[0]);
    expect(aligned[1]).toBe(only[1]);
    expect(aligned[2]).toBe(only[2]);
  });

  it('is empty columns for a device that has never reported', () => {
    expect(alignedBuffers([undefined], [1])).toEqual([[], []]);
    expect(alignedBuffers([undefined], [1, 2])).toEqual([[], [], []]);
  });

  it('merges interleaved timestamps and nulls each device elsewhere', () => {
    expect(
      alignedBuffers(
        [buffer([1, 3], [70, 72]), buffer([2, 3.5], [80, 81])],
        [1],
      ),
    ).toEqual([
      [1, 2, 3, 3.5],
      [70, null, 72, null],
      [null, 80, null, 81],
    ]);
  });

  // The union is built once whatever the window count — the samples are the same instants
  // whichever quantity is read off them — and every block is aligned to it.
  it('aligns every window to one merged x column', () => {
    expect(
      alignedBuffers(
        [buffer([1, 3], [70, 72], [60, 62]), buffer([2], [80], [65])],
        [1, 2],
      ),
    ).toEqual([
      [1, 2, 3],
      [70, null, 72],
      [null, 80, null],
      [60, null, 62],
      [null, 65, null],
    ]);
  });

  it('lets two devices share a timestamp they both reported at', () => {
    expect(
      alignedBuffers([buffer([1, 2], [70, 71]), buffer([2], [80])], [1]),
    ).toEqual([
      [1, 2],
      [70, 71],
      [null, 80],
    ]);
  });

  it('pads a device with no buffer alongside one that has samples', () => {
    expect(alignedBuffers([undefined, buffer([1, 2], [80, 81])], [1])).toEqual([
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

// What makes a location's chart the location's rather than its monitors': a monitor's
// trace covers the event wherever it stood, and only the stretches it stood *here*
// belong on this chart. `xs` is uPlot's epoch seconds, the windows are epoch ms.
describe('maskToWindows', () => {
  const xs = [60, 120, 180, 240];
  const column = [70, 80, 90, 100];

  it('keeps only the samples inside a window', () => {
    expect(maskToWindows(xs, column, [{start: 120_000, end: 240_000}])).toEqual(
      [null, 80, 90, null],
    );
  });

  // Start inclusive, end exclusive, as everywhere else in this section — so a monitor
  // handed over at 18:00 stops exactly where the next one starts and the two lines meet
  // without both claiming the instant.
  it('gives a handover instant to the later window alone', () => {
    expect(maskToWindows(xs, column, [{start: 0, end: 180_000}])).toEqual([
      70,
      80,
      null,
      null,
    ]);
    expect(maskToWindows(xs, column, [{start: 180_000, end: null}])).toEqual([
      null,
      null,
      90,
      100,
    ]);
  });

  // One line per monitor, so a monitor carried away and brought back is two windows on
  // the same column with a break between them rather than two lines.
  it('keeps both stints of a monitor that came back', () => {
    expect(
      maskToWindows(xs, column, [
        {start: 60_000, end: 120_000},
        {start: 240_000, end: null},
      ]),
    ).toEqual([70, null, null, 100]);
  });

  it('blanks everything for a monitor this location never had', () => {
    expect(maskToWindows(xs, column, [])).toEqual([null, null, null, null]);
  });

  // A minute the monitor didn't report stays a gap: masking only ever removes.
  it('leaves the column’s own nulls alone', () => {
    expect(
      maskToWindows(xs, [70, null, 90, 100], [{start: 0, end: null}]),
    ).toEqual([70, null, 90, 100]);
  });
});

// The chart's column layout, from both ends: traceData writes it and traceColumn reads it
// back, and a disagreement of one between them draws real levels under the wrong monitor's
// name — which is why the arithmetic is in one place and pinned here.
describe('traceColumn', () => {
  it('runs window by window through the monitors', () => {
    // Two monitors, three windows: block per window, monitor within it.
    const layout = [0, 1, 2].flatMap((m) =>
      [0, 1].map((d) => traceColumn(m, d, 2, false)),
    );
    expect(layout).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('leaves room for the envelope where there is one', () => {
    expect(traceColumn(0, 0, 2, false)).toBe(1);
    // Column 1 is the filled envelope then, so the monitors start after it.
    expect(traceColumn(0, 0, 2, true)).toBe(2);
    expect(traceColumn(0, 1, 2, true)).toBe(3);
  });

  it('is one column per window for a lone monitor', () => {
    expect([0, 1].map((m) => traceColumn(m, 0, 1, false))).toEqual([1, 2]);
  });
});

describe('traceData', () => {
  const xs = [60, 120, 180];
  // Two monitors that stood here at different times, which is what the masking is for.
  const windows = [[{start: 0, end: 120_000}], [{start: 120_000, end: null}]];

  it('clips every window of a monitor to that monitor’s stints', () => {
    const aligned = [
      xs,
      // window A: mic-1, mic-2
      [70, 71, 72],
      [80, 81, 82],
      // window B: mic-1, mic-2
      [60, 61, 62],
      [65, 66, 67],
    ];
    expect(
      traceData(aligned, windows, {
        metricCount: 2,
        envelope: false,
        holdX: 90,
      }),
    ).toEqual([
      xs,
      [70, null, null],
      [null, 81, 82],
      [60, null, null],
      [null, 66, 67],
    ]);
  });

  it('puts the envelope of the masked monitors in front of them', () => {
    const aligned = [xs, [70, 71, 72], [80, 81, 82]];
    expect(
      traceData(aligned, windows, {metricCount: 1, envelope: true, holdX: 90}),
    ).toEqual([
      xs,
      // The loudest of the two *after* clipping, holding each at its last reading — mic-1
      // stops at the handover and mic-2 starts there.
      [70, 81, 82],
      [70, null, null],
      [null, 81, 82],
    ]);
  });

  // The mismatch that throws: uPlot indexes data by series, so a projection narrower than
  // the series list dies on the first draw and a wider one silently never draws its tail.
  // Every shape the chart can be in, including the location nothing has ever stood at.
  it('is one column per window per monitor, whatever the counts', () => {
    for (const metricCount of [1, 2, 5]) {
      for (const deviceCount of [0, 1, 2, 3]) {
        const envelope = deviceCount > 1 && metricCount === 1;
        const aligned = [
          xs,
          ...Array.from({length: metricCount * deviceCount}, () => [
            70, 71, 72,
          ]),
        ];
        const data = traceData(
          aligned,
          Array.from({length: deviceCount}, () => [{start: 0, end: null}]),
          {metricCount, envelope, holdX: 90},
        );
        expect(data).toHaveLength(
          1 + (envelope ? 1 : 0) + metricCount * Math.max(1, deviceCount),
        );
      }
    }
  });

  it('draws empty columns where nothing has ever stood', () => {
    expect(
      traceData([[]], [], {metricCount: 3, envelope: false, holdX: 90}),
    ).toEqual([[], [], [], []]);
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
