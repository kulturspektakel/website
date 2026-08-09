import {type NoiseRecording} from '../../proto/noise';
import {
  decodeDb,
  type DeviceBuffer,
  type DeviceSeries,
  type HistoryRow,
  type Weighting,
} from './noise';

// The one table to edit when adding, recolouring or reordering a chart line.
//
// The live and historical pages plot the same nine series — the only difference
// is the fast window (one second live, one minute in history) and where the
// value comes from (a decoded MQTT record vs a column of the history query).
// Both used to be their own nine-entry table, which meant every change was a
// lockstep edit across two lists with nothing checking they still matched.
//
// Order is load-bearing: it is the legend order within a weighting, and it is
// the column order of the aligned chart data (column i+1 mirrors SERIES[i]),
// which nothing in the type system enforces — see series.test.ts.

// The weighting-independent identity of a series, so the legend's toggle state
// carries across the dB(A)/dB(C) switch: hiding LAFmax hides LCFmax too.
export type SeriesKind = 'eq_fast' | 'eq_5m' | 'eq_30m' | 'fmax' | 'peak';

export type NoiseSeries = {
  kind: SeriesKind;
  weighting: Weighting;
  stroke: string;
  // Hidden from the chart by default; still toggleable via the legend.
  hidden?: boolean;
  liveLabel: string;
  historyLabel: string;
  // The live value, off a decoded MQTT record.
  get: (d: NoiseRecording) => number | null;
  // The historical value's column; the query decodes it to dB per row.
  col: keyof HistoryRow;
};

// Each Leq is a shade of yellow (lighter → darker as the window grows); max and
// peak are shades of orange. All lines are solid.
export const SERIES: readonly NoiseSeries[] = [
  {
    kind: 'eq_fast',
    weighting: 'A',
    stroke: '#fef08a',
    liveLabel: 'LAeq,1s',
    historyLabel: 'LAeq,1m',
    get: (d) => decodeDb(d.laeq),
    col: 'laeq_1m',
  },
  {
    kind: 'eq_5m',
    weighting: 'A',
    stroke: '#eab308',
    liveLabel: 'LAeq,5m',
    historyLabel: 'LAeq,5m',
    get: (d) => (d.laeq5m == null ? null : decodeDb(d.laeq5m)),
    col: 'laeq_5m',
  },
  {
    kind: 'eq_30m',
    weighting: 'A',
    stroke: '#a16207',
    liveLabel: 'LAeq,30m',
    historyLabel: 'LAeq,30m',
    get: (d) => (d.laeq30m == null ? null : decodeDb(d.laeq30m)),
    col: 'laeq_30m',
  },
  {
    kind: 'fmax',
    weighting: 'A',
    stroke: '#f87171',
    hidden: true,
    liveLabel: 'LAFmax',
    historyLabel: 'LAFmax',
    get: (d) => decodeDb(d.lafmax),
    col: 'lafmax',
  },
  {
    kind: 'eq_fast',
    weighting: 'C',
    stroke: '#fef08a',
    liveLabel: 'LCeq,1s',
    historyLabel: 'LCeq,1m',
    get: (d) => decodeDb(d.lceq),
    col: 'lceq_1m',
  },
  {
    kind: 'eq_5m',
    weighting: 'C',
    stroke: '#eab308',
    liveLabel: 'LCeq,5m',
    historyLabel: 'LCeq,5m',
    get: (d) => (d.lceq5m == null ? null : decodeDb(d.lceq5m)),
    col: 'lceq_5m',
  },
  {
    kind: 'eq_30m',
    weighting: 'C',
    stroke: '#a16207',
    liveLabel: 'LCeq,30m',
    historyLabel: 'LCeq,30m',
    get: (d) => (d.lceq30m == null ? null : decodeDb(d.lceq30m)),
    col: 'lceq_30m',
  },
  {
    kind: 'fmax',
    weighting: 'C',
    stroke: '#f87171',
    hidden: true,
    liveLabel: 'LCFmax',
    historyLabel: 'LCFmax',
    get: (d) => decodeDb(d.lcfmax),
    col: 'lcfmax',
  },
  {
    kind: 'peak',
    weighting: 'C',
    stroke: '#b91c1c',
    hidden: true,
    liveLabel: 'LCpeak',
    historyLabel: 'LCpeak',
    get: (d) => decodeDb(d.lcpeak),
    col: 'lcpeak',
  },
];

// A series with its label resolved for one of the two pages. Both views want
// the same shape, so the charts and the big-number row are written once against
// this rather than twice against two tables.
export type ChartSeries = NoiseSeries & {label: string};

export const LIVE_SERIES: readonly ChartSeries[] = SERIES.map((s) => ({
  ...s,
  label: s.liveLabel,
}));

export const HISTORY_SERIES: readonly ChartSeries[] = SERIES.map((s) => ({
  ...s,
  label: s.historyLabel,
}));

// A live buffer with no samples in it: the timestamp column plus one column per
// series. Lives here because the column count is the series table's business,
// and a buffer with the wrong width is a chart that plots the wrong lines.
export const emptyBuffer = (): DeviceBuffer => [
  [],
  ...SERIES.map(() => [] as number[]),
];

// One row of the table, by what it *is* rather than by where it sits. Every
// (kind, weighting) pair that this file lists exists — see series.test.ts — which
// is what makes the assertion safe, and it is the only place the pair is looked
// up: level.ts reads `get`/`col` off it, the charts read `stroke`.
export const seriesFor = (
  kind: SeriesKind,
  weighting: Weighting,
): NoiseSeries =>
  SERIES.find((s) => s.kind === kind && s.weighting === weighting)!;

// Not every kind exists under both weightings — a peak is only ever C-weighted, which
// is why seriesFor's assertion needs a way to be checked rather than trusted. The
// picker asks this to decide what it may offer for the weighting in force.
export const hasSeries = (kind: SeriesKind, weighting: Weighting): boolean =>
  SERIES.some((s) => s.kind === kind && s.weighting === weighting);

// Which live-buffer column holds a series: column 0 is the timestamps and column
// i+1 mirrors SERIES[i]. That convention is this file's (see emptyBuffer above and
// rowsToAligned below), so reading it is too — a chart that worked the +1 out for
// itself would keep plotting a plausible-looking wrong line if the layout changed.
export const bufferColumn = (kind: SeriesKind, weighting: Weighting): number =>
  SERIES.indexOf(seriesFor(kind, weighting)) + 1;

// Several devices in one chart, which uPlot's aligned data means one x column and a
// y column per device. Both aligners live here for the same reason rowsToAligned
// does: the column layout is this file's convention, and a chart that joined the
// data itself would be the second place that decides it.

/**
 * Stored traces → [xs, ...one column per device], in the order asked for.
 *
 * No joining, because there is nothing to join: logSeries builds the minute grid once
 * and hands every device the same `xs` array, with nulls for the minutes it has
 * nothing (see projectLogs.ts). A device with no trace at all — one that measured
 * nothing in the project — is padded to that grid so its column still lines up.
 */
export function alignedSeries(
  series: Array<DeviceSeries | undefined>,
): (number | null)[][] {
  const xs = series.find((s) => s != null)?.xs ?? [];
  return [xs, ...series.map((s) => s?.db ?? nulls(xs.length))];
}

const nulls = (length: number): (number | null)[] =>
  new Array<number | null>(length).fill(null);

/**
 * Live buffers → [xs, ...one column per device], reading `col` out of each.
 *
 * Unlike the stored traces these share no grid: every device is appended to on its
 * own message, so their timestamps interleave. The union of them is the x column, and
 * a device is null at the instants that belong to the others — which is why the
 * series drawn from this want makeSampleGapsRefiner rather than uPlot's own nulls.
 *
 * One device is the overwhelmingly common case and is handed back untouched: its own
 * timestamps already are the union, and its columns are what the chart would build.
 */
export function alignedBuffers(
  buffers: Array<DeviceBuffer | undefined>,
  col: number,
): (number | null)[][] {
  if (buffers.length === 1) {
    const only = buffers[0];
    return only ? [only[0]!, only[col]!] : [[], []];
  }
  // Sorted and deduplicated rather than merged pairwise: a window holds a few hundred
  // samples per device and this runs once a second per chart, so the clearer of the
  // two is fast enough by a wide margin.
  const xs = [...new Set(buffers.flatMap((b) => (b ? b[0]! : [])))].sort(
    (a, b) => (a as number) - (b as number),
  ) as number[];
  return [
    xs,
    ...buffers.map((buffer) => {
      const out = nulls(xs.length);
      if (!buffer) return out;
      const times = buffer[0]!;
      const values = buffer[col]!;
      // Both sides are sorted, so one pass with a pointer into the union places every
      // sample: equal timestamps from two devices share the slot they were merged into.
      let at = 0;
      for (let i = 0; i < times.length; i++) {
        while (at < xs.length && xs[at]! < (times[i] as number)) at++;
        if (at >= xs.length) break;
        out[at] = values[i] ?? null;
      }
      return out;
    }),
  ];
}

/**
 * One device's column, blanked outside the stretches it belongs to — what turns a
 * monitor's trace into a location's.
 *
 * A monitor's stored history covers the whole event wherever it stood, so a location that
 * had it for one evening must not draw the rest: everything outside its windows becomes
 * null, which is a break in the line rather than a value of nothing. Live buffers get the
 * same treatment, so a monitor carried off to another stage stops drawing here the moment
 * its assignment ended rather than the moment it next goes quiet.
 *
 * `xs` is in uPlot's epoch seconds and the windows are in the epoch milliseconds
 * everything else in this section speaks, so the conversion happens here — once per
 * window rather than once per sample. `[start, end)`, and an open end runs to the last
 * sample, matching assignmentsAt: a monitor handed over at 18:00 stops here exactly where
 * the next one starts, and the two lines meet without overlapping by a point.
 *
 * No windows at all is a line with nothing to show rather than a line with everything:
 * the caller only ever passes an empty list for a device this location never had.
 */
export function maskToWindows(
  xs: readonly number[],
  column: readonly (number | null)[],
  windows: readonly {start: number; end: number | null}[],
): (number | null)[] {
  const from = windows.map((w) => w.start / 1000);
  const to = windows.map((w) => (w.end == null ? Infinity : w.end / 1000));
  // Nulls up front and only the kept samples written back, so the common case — a
  // monitor that stood here for one evening of a four-day event — writes a few hundred
  // slots of the thousands it is handed rather than all of them.
  const out = new Array<number | null>(xs.length).fill(null);
  // Two flat loops rather than `bounds.some(…)`: the callback would close over `x` and
  // so be allocated once per sample, and this runs over the whole project's minute grid
  // for every line of every card on the list — and once a second per card while live.
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    for (let w = 0; w < from.length; w++) {
      if (x >= from[w]! && x < to[w]!) {
        out[i] = column[i] ?? null;
        break;
      }
    }
  }
  return out;
}

/**
 * The loudest of several aligned columns at each x — a location's envelope, which is
 * what a chart of its monitors fills the area under: the lines all being one colour,
 * two filled areas would stack into a shade that looks like it means something.
 *
 * A monitor counts as still being at its last reading until `holdX` past it. Without
 * that this would sawtooth rather than trace anything: live buffers interleave, so at
 * most instants exactly one monitor has a value and a plain pointwise max would follow
 * whoever spoke last. Past `holdX` it has gone quiet and contributes nothing — the same
 * threshold at which its own line breaks.
 */
export function loudestColumn(
  xs: number[],
  columns: (number | null)[][],
  holdX: number,
): (number | null)[] {
  // Last reading per column, and when it came: walked forward with the x, so this is
  // one pass whatever the device count. Plain loops over two flat arrays, because the
  // stored grid is every minute of the festival and the callbacks a map/forEach pair
  // would allocate per point are the only cost here worth avoiding.
  const lastAt = new Array<number>(columns.length).fill(-Infinity);
  const lastDb = new Array<number>(columns.length).fill(0);
  const out = new Array<number | null>(xs.length);
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]!;
    let loudest: number | null = null;
    for (let c = 0; c < columns.length; c++) {
      const db = columns[c]![i];
      if (db != null) {
        lastAt[c] = x;
        lastDb[c] = db;
      }
      if (x - lastAt[c]! > holdX) continue;
      if (loudest == null || lastDb[c]! > loudest) loudest = lastDb[c]!;
    }
    out[i] = loudest;
  }
  return out;
}

// History rows → uPlot's column-major shape: [xs, ...one column per series].
// Only minutes that had data are present, so gaps are rendered by
// NoiseTimeChart's gap refiner (a > threshold jump between consecutive x
// values), no explicit null rows needed. Individual nulls (a missing 5m/30m
// value on an otherwise-present minute) break just that line. The view casts
// the result to uPlot.AlignedData at the chart edge.
//
// Lives here rather than beside the query because it is a projection of the
// series table, and because this side is importable without Prisma.
export function rowsToAligned(rows: HistoryRow[]): (number | null)[][] {
  const xs = rows.map((r) => r.minute_epoch);
  const cols = SERIES.map((s) => rows.map((r) => r[s.col]));
  return [xs, ...cols];
}
