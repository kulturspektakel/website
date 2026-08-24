import {type NoiseRecording} from '../../proto/noise';
import {type ChartSeriesToken} from '../../theme-noise';
import {
  decodeDb,
  type DeviceBuffer,
  type DeviceSeries,
  type HistoryRow,
  type Weighting,
} from './noise';

// The one table to edit when adding or reordering a chart line. Recolouring is
// theme-noise's — a line's colour is `chart.series.<kind>` and nothing here
// picks it, which is what stopped the two weightings of one kind from being
// able to drift apart.
//
// The live and historical pages plot the same nine series — the only difference
// is the fast window (one second live, one minute in history) and where the
// value comes from (a decoded MQTT record vs a column of the history query).
// Both used to be their own nine-entry table, which meant every change was a
// lockstep edit across two lists with nothing checking they still matched.
//
// Order is load-bearing three times over: it is the column order of the live
// buffers (column i+1 mirrors SERIES[i]), which nothing in the type system
// enforces — see series.test.ts; it is the order the picker lists its rows in,
// A-weighted block first and finest window first within each; and because of
// that it is what decides the *primary* of a pick, the first of it in this
// order (see primarySeries). So the table is grouped by weighting rather than
// interleaved by kind, and that grouping is what the menu's two blocks are.
//
// A chart's columns are laid out here too, one per (metric, device) — see the aligners
// and traceColumn below.

// What a series measures, apart from the filter it is measured through: the quantity
// and the window, which is what the two weightings of one row have in common — and so
// what they share a colour for (see below).
export type SeriesKind = 'eq_fast' | 'eq_5m' | 'eq_30m' | 'fmax' | 'peak';

/**
 * One row of the table, named — the whole of what the pages pick, since the weighting
 * stopped being a mode of the page and became part of what a line *is* (see level.ts).
 *
 * A string rather than a `{kind, weighting}` pair for two reasons that are the same
 * reason: it can key a Record — the playhead's levels and the stored traces are both
 * keyed by one — and it can go into the `join(' ')` digests every memo in this section
 * uses in place of an array identity.
 */
export type SeriesKey = `${SeriesKind}:${Weighting}`;

export const seriesKey = (kind: SeriesKind, weighting: Weighting): SeriesKey =>
  `${kind}:${weighting}`;

export type NoiseSeries = {
  kind: SeriesKind;
  weighting: Weighting;
  // The theme token this line is drawn in. Derived from `kind` below rather
  // than written per row: a kind's two weightings are the same measurement
  // under a different filter and must be the same colour, and the rows can't
  // disagree about something none of them states.
  color: ChartSeriesToken;
  liveLabel: string;
  // The live value, off a decoded MQTT record.
  get: (d: NoiseRecording) => number | null;
  // The historical value's column; the query decodes it to dB per row.
  col: keyof HistoryRow;
};

// The ramp runs yellow → orange → red, lightest at the shortest averaging
// window, with max and peak at the red end. All lines are solid. The shades
// themselves live in theme-noise.ts, which is also where the reasoning about
// them being legible against this section's ground is written down.
const TABLE: readonly Omit<NoiseSeries, 'color'>[] = [
  {
    kind: 'eq_fast',
    weighting: 'A',
    liveLabel: 'LAeq,1s',
    get: (d) => decodeDb(d.laeq),
    col: 'laeq_1m',
  },
  {
    kind: 'eq_5m',
    weighting: 'A',
    liveLabel: 'LAeq,5m',
    get: (d) => (d.laeq5m == null ? null : decodeDb(d.laeq5m)),
    col: 'laeq_5m',
  },
  {
    kind: 'eq_30m',
    weighting: 'A',
    liveLabel: 'LAeq,30m',
    get: (d) => (d.laeq30m == null ? null : decodeDb(d.laeq30m)),
    col: 'laeq_30m',
  },
  {
    kind: 'fmax',
    weighting: 'A',
    liveLabel: 'LAFmax',
    get: (d) => decodeDb(d.lafmax),
    col: 'lafmax',
  },
  {
    kind: 'eq_fast',
    weighting: 'C',
    liveLabel: 'LCeq,1s',
    get: (d) => decodeDb(d.lceq),
    col: 'lceq_1m',
  },
  {
    kind: 'eq_5m',
    weighting: 'C',
    liveLabel: 'LCeq,5m',
    get: (d) => (d.lceq5m == null ? null : decodeDb(d.lceq5m)),
    col: 'lceq_5m',
  },
  {
    kind: 'eq_30m',
    weighting: 'C',
    liveLabel: 'LCeq,30m',
    get: (d) => (d.lceq30m == null ? null : decodeDb(d.lceq30m)),
    col: 'lceq_30m',
  },
  {
    kind: 'fmax',
    weighting: 'C',
    liveLabel: 'LCFmax',
    get: (d) => decodeDb(d.lcfmax),
    col: 'lcfmax',
  },
  {
    kind: 'peak',
    weighting: 'C',
    liveLabel: 'LCpeak',
    get: (d) => decodeDb(d.lcpeak),
    col: 'lcpeak',
  },
];

export const SERIES: readonly NoiseSeries[] = TABLE.map((s) => ({
  ...s,
  color: `chart.series.${s.kind}`,
}));

// Every row's name, in the table's order — which is the picker's order, and so the
// order a pick is kept in (see toggledSeries). The one list anything enumerating the
// section's quantities walks.
export const SERIES_KEYS: readonly SeriesKey[] = SERIES.map((s) =>
  seriesKey(s.kind, s.weighting),
);

// Names resolved back to rows once, so a lookup is not a scan of the table: this is
// read per device per window on every minute the playhead crosses, and per line on
// every rebuild of every chart on the list.
const BY_KEY = new Map<SeriesKey, NoiseSeries>(
  SERIES.map((s) => [seriesKey(s.kind, s.weighting), s]),
);

// A name back to what it names. Total by construction — the only keys that exist are
// the ones SERIES_KEYS produced, and a `SeriesKey` that isn't one of them cannot be
// written down without asserting it (series.test.ts checks the pair round-trips).
export const seriesByKey = (key: SeriesKey): NoiseSeries => BY_KEY.get(key)!;

// Whether a name from outside this program names a row of the table — which is a question
// only for values that were not written down as `SeriesKey`s. There is exactly one such
// source: a stored loudness limit names the series it is written against, and a column of
// text is not a union (see NoiseLocationLimit). Both the server fn that accepts one and the
// loader that reads one back go through this, so a series that has been renamed out of the
// table cannot arrive at a chart as a colour lookup that misses.
export const isSeriesKey = (value: string): value is SeriesKey =>
  BY_KEY.has(value as SeriesKey);

// A series with its label resolved. Kept apart from the table itself because a label is a
// presentation of a series rather than part of one — the table carries what to plot, this
// carries what to call it.
export type ChartSeries = NoiseSeries & {label: string};

export const LIVE_SERIES: readonly ChartSeries[] = SERIES.map((s) => ({
  ...s,
  label: s.liveLabel,
}));

// A live buffer with no samples in it: the timestamp column plus one column per
// series. Lives here because the column count is the series table's business,
// and a buffer with the wrong width is a chart that plots the wrong lines.
export const emptyBuffer = (): DeviceBuffer => [
  [],
  ...SERIES.map(() => [] as number[]),
];

// Rows are looked up by name and only by name — see seriesByKey above. There used to be a
// `seriesFor(kind, weighting)` beside it and a `hasSeries` to guard it, because the pages
// held a kind and a weighting apart and could ask for the one pair that doesn't exist
// (LCpeak's A-weighted twin). A key is a row that is already known to be there, so both
// questions went with the two controls that raised them.

// Which live-buffer column holds a series: column 0 is the timestamps and column
// i+1 mirrors SERIES[i]. That convention is this file's (see emptyBuffer above), so
// reading it is too — a chart that worked the +1 out for itself would keep plotting a
// plausible-looking wrong line if the layout changed.
export const bufferColumn = (key: SeriesKey): number =>
  SERIES_KEYS.indexOf(key) + 1;

/**
 * One whole sample of a live buffer: the row nearest an instant, if a sample is near
 * enough to *be* the reading at it.
 *
 * The row and not one series' value, because everything that asks this asks it of every
 * series at once — the device page's tile row prints all nine — and nine searches for one
 * instant would be nine chances to land on different samples. Indexed by bufferColumn,
 * which is why it is returned as the buffer's own row rather than as a record: the column
 * layout is this file's, and so is reading it.
 *
 * `toleranceS` is how far the nearest sample may be and still be the one under the
 * pointer — GAP_THRESHOLD_S for a hover over the live trace, the same distance that chart
 * breaks its line at. Past it there is nothing there: null, which is the honest answer for
 * an instant the monitor was silent through, and not the reading on the far side of the
 * gap.
 */
export function bufferSampleAt(
  buffer: DeviceBuffer | undefined,
  atMs: number,
  toleranceS: number,
): (number | null)[] | null {
  const times = buffer?.[0];
  if (!buffer || !times?.length) return null;
  const at = atMs / 1000;
  // Ascending by construction — ingest only ever appends, and trims off the front — so
  // the sample is found rather than scanned for: a live window holds a few hundred of
  // them and this runs on every frame of a hover.
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((times[mid] as number) < at) lo = mid + 1;
    else hi = mid;
  }
  // The first sample at or after the instant; the one before it may well be nearer, the
  // pointer being anywhere between the two.
  const before = lo > 0 ? lo - 1 : lo;
  const nearest =
    Math.abs((times[before] as number) - at) <=
    Math.abs((times[lo] as number) - at)
      ? before
      : lo;
  if (Math.abs((times[nearest] as number) - at) > toleranceS) return null;
  return buffer.map((column) => column[nearest] ?? null);
}

// Several metrics and several devices in one chart, which in uPlot's aligned data means
// one x column and a y column per pair of them. Both aligners live here for the same
// reason bufferColumn does: the column layout is this file's convention, and a chart that
// joined the data itself would be the second place that decides it.
//
// The layout is metric-major — every device of the first metric, then every device of the
// second, and so on (see traceColumn, which is the one place that arithmetic is written).
// Chosen over device-major because that is the shape both sources arrive in: a live column
// is one bufferColumn read across every device, and a stored group is one metric's record
// across every device. Device-major would mean interleaving after alignment, i.e. a second
// ordering convention to keep in step with this one. It also means a metric's lines are a
// run of consecutive series, so the stroke is fixed per block rather than per column.
//
// Both take *every* metric in one call rather than being called once each, so there is one
// x column by construction instead of several that happen to be equal — which is the whole
// reason this file owns the join.

/**
 * Stored traces → [xs, ...one column per (metric, device)], metric-major.
 *
 * `groups` is one entry per metric, each holding one entry per device in the chart's own
 * order — so `groups[m]![d]` is the trace to draw for metric m at device d.
 *
 * No joining, because there is nothing to join: logSeries builds the minute grid once and
 * hands every device of every metric the same `xs` array, with nulls for the minutes it
 * has nothing (see projectLogs.ts). A device with no trace at all — one that measured
 * nothing in the project — is padded to that grid so its column still lines up, and so is
 * a metric the payload never carried.
 */
export function alignedSeries(
  groups: ReadonlyArray<ReadonlyArray<DeviceSeries | undefined>>,
): (number | null)[][] {
  // From wherever it can be found: one grid is shared across metrics as well as devices,
  // so the first trace that exists anywhere carries the x of all of them.
  const xs = groups.flat().find((s) => s != null)?.xs ?? [];
  return [
    xs,
    ...groups.flatMap((group) => group.map((s) => s?.db ?? nulls(xs.length))),
  ];
}

const nulls = (length: number): (number | null)[] =>
  new Array<number | null>(length).fill(null);

/**
 * Live buffers → [xs, ...one column per (metric, device)], metric-major, reading `cols`
 * out of each buffer — one buffer column per metric, in the chart's own metric order (see
 * bufferColumn).
 *
 * Unlike the stored traces these share no grid: every device is appended to on its
 * own message, so their timestamps interleave. The union of them is the x column, and
 * a device is null at the instants that belong to the others — which is why the
 * series drawn from this want makeSampleGapsRefiner rather than uPlot's own nulls.
 *
 * That union is computed once for every metric, which is the other half of why the metric
 * list is a parameter: a device's samples are the same instants whichever quantity is read
 * off them, so building the grid per metric would be the same sort several times over.
 *
 * One device is the overwhelmingly common case and is handed back untouched: its own
 * timestamps already are the union, and its columns are what the chart would build.
 */
export function alignedBuffers(
  buffers: Array<DeviceBuffer | undefined>,
  cols: readonly number[],
): (number | null)[][] {
  if (buffers.length === 1) {
    const only = buffers[0];
    return only
      ? [only[0]!, ...cols.map((col) => only[col]!)]
      : [[], ...cols.map(() => [])];
  }
  // Sorted and deduplicated rather than merged pairwise: a window holds a few hundred
  // samples per device and this runs once a second per chart, so the clearer of the
  // two is fast enough by a wide margin.
  const xs = [...new Set(buffers.flatMap((b) => (b ? b[0]! : [])))].sort(
    (a, b) => (a as number) - (b as number),
  ) as number[];
  return [
    xs,
    ...cols.flatMap((col) =>
      buffers.map((buffer) => {
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
    ),
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
 * Only ever called for a chart drawing *one* metric, which is what makes "the lines are
 * all one colour" true. Several metrics have several colours and are nested besides
 * (Peak ≥ Fmax ≥ Leq), so there the fill is dropped rather than recoloured — see
 * traceData, and LevelTrace's series list for what an area over a quieter line would do.
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

/**
 * Where one monitor's line for one metric sits in a metric-major projection — the reverse
 * of the layout traceData builds, for a caller reading a value back out of it (see
 * LevelTrace's tooltip).
 *
 * Here rather than worked out at the two ends, because a projection whose writer and whose
 * reader disagree about this by one draws a plausible-looking wrong chart: the numbers are
 * all real levels, just attributed to the wrong monitor or the wrong quantity.
 */
export const traceColumn = (
  metricIndex: number,
  deviceIndex: number,
  deviceCount: number,
  envelope: boolean,
): number => (envelope ? 2 : 1) + metricIndex * deviceCount + deviceIndex;

/**
 * An aligner's output → what uPlot is handed: every column clipped to its own monitor's
 * windows, with the envelope in front of them where there is one.
 *
 * The clipping is what makes this a chart of a *location* rather than of its monitors: a
 * monitor's history covers the event wherever it stood, and every metric of it has to be
 * cut to the same windows, so the mask is per device and applied once per block.
 *
 * `envelope` is the caller's decision and means "one metric, several monitors" — the only
 * shape a single filled area describes (see loudestColumn). It is passed rather than
 * derived so that this, the series list and the tooltip all read one flag.
 *
 * A location nothing has ever stood at still gets one empty column *per metric*, not one
 * column: uPlot indexes data by series, so a projection narrower than the series list
 * throws on the first draw and a wider one silently never draws its tail.
 */
export function traceData(
  aligned: (number | null)[][],
  // One entry per device, in the same order the aligner was given them.
  windows: ReadonlyArray<readonly {start: number; end: number | null}[]>,
  {
    metricCount,
    envelope,
    holdX,
  }: {metricCount: number; envelope: boolean; holdX: number},
): (number | null)[][] {
  const xs = (aligned[0] ?? []) as number[];
  const deviceCount = windows.length;
  if (deviceCount === 0) {
    return [xs, ...Array.from({length: metricCount}, () => [])];
  }
  // Nested rather than a walk of `aligned` with a modulo: the loop *is* the layout, so
  // the block order is written the same way here as it is read in traceColumn.
  const columns: (number | null)[][] = [];
  for (let m = 0; m < metricCount; m++) {
    for (let d = 0; d < deviceCount; d++) {
      columns.push(
        maskToWindows(xs, aligned[1 + m * deviceCount + d] ?? [], windows[d]!),
      );
    }
  }
  if (!envelope) return [xs, ...columns];
  return [xs, loudestColumn(xs, columns, holdX), ...columns];
}
