import {type NoiseRecording} from '../../proto/noise';
import {
  decodeDb,
  type DeviceBuffer,
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
