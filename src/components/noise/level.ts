import {type NoiseRecording} from '../../proto/noise';
import {isFresh, WEIGHTINGS, type DeviceState, type Weighting} from './noise';
import {
  seriesByKey,
  SERIES_KEYS,
  type SeriesKey,
  type SeriesKind,
} from './series';

// How old a live record may be and still count as "right now". Records arrive about
// once a second, so ten seconds is several missed messages in a row. Past it the
// number is still shown — it is the last thing the monitor said — but as `stale`,
// which every caller renders muted, so it can't be read as a current level.
//
// Deliberately longer than ACTIVE_WINDOW_MS (5 s), which drives the online dot: a
// monitor that just dropped off shows a grey dot while its last number lingers a
// few seconds, rather than both vanishing on the same frame.
export const LIVE_LEVEL_WINDOW_MS = 10_000;

// The quantities this section knows, apart from the filter they are measured through:
// the three Leq windows and the two maxima. Not what is *picked* — that is a set of
// series, weighting included (see PickedSeries) — but the kinds those series are of, and
// so what a colour, a tag and a tile row are per.
//
// Order is load-bearing: it is the order of the kinds within each of the picker's two
// weighting blocks, of the device page's tiles, and of the chart's columns (see
// traceColumn). Finest first, which is what makes the primary of a pick the finest thing
// in it.
//
// SERIES is the same five kinds crossed with the two weightings, in this order within
// each — series.test.ts holds the two lists to it.
export const LEVEL_METRICS = [
  'eq_fast',
  'eq_5m',
  'eq_30m',
  'fmax',
  'peak',
] as const satisfies readonly SeriesKind[];
export type LevelMetric = (typeof LEVEL_METRICS)[number];

/**
 * What the header's menu picks: a set of *series* — a quantity and the weighting it is
 * read through, together — in SERIES_KEYS order, and never empty. Page-wide, so a pin and
 * the row beside it can never be showing different lines.
 *
 * One control and one set, because the weighting is not a mode of the page: `LAeq,5m` and
 * `LCeq,5m` are two measurements, and the interesting question is usually a comparison —
 * the A against the C, the minute Leq against LAFmax, the 5m against the 30m. That the
 * pick is a subset of the series table is the point: what is picked *is* the set of lines
 * the charts draw, each resolving through that table to its column, its getter and its
 * shade. Every column is already in the browser (the stored payload carries all nine and
 * so do the live buffers), so a second line costs a projection and not a request.
 *
 * A tuple rather than an array so the "never empty" half is the compiler's business and
 * primarySeries needs no fallback. Only useLevelPick has to prove it, which it does by
 * being the one thing that produces these — everything downstream is handed one.
 *
 * The Leq over the selected timeframe is picked in the same menu and is deliberately not
 * one of these: it has no line, no live counterpart and no playhead, so nothing downstream
 * of a series — the table, the traces, the chart's columns — has an answer for it. It
 * travels as its own flag beside this set (see useLevelPick) and is read off the cards
 * only, which is why the menu is nine rows plus one that isn't a series.
 */
export type PickedSeries = readonly [SeriesKey, ...SeriesKey[]];

/**
 * The one series the *single* numbers are read in, of however many the charts are
 * drawing: the first of them in table order, which is the finest A-weighted thing picked
 * where there is one and the finest C-weighted thing otherwise.
 *
 * Derived rather than picked separately, so there is no second piece of state and no "the
 * primary must be one of the picked" invariant to keep. Two things read it: a map pin,
 * which is a badge over a place and has room for one number, and the crop's Leq, which is
 * one energetic mean and so has to be in one weighting (see locationEnergyIndex). The
 * picker's trigger names it for that reason.
 */
export const primarySeries = (picked: PickedSeries): SeriesKey => picked[0];

/**
 * Which weighting the *single* numbers come out in, which is the primary's.
 *
 * Its own function because three places want it and none of them wants the series: the hook
 * that sums the crop's Leq (one energetic mean has room for exactly one weighting), the
 * picker's row for that mean, and the card's badge under it. Two of those only name the
 * number the third computed, so a rule derived three ways is how a card comes to print
 * `LAeq,Range` over a C-weighted figure — a wrong label on a right number, which is the
 * failure nobody notices.
 */
export const primaryWeighting = (picked: PickedSeries): Weighting =>
  seriesByKey(primarySeries(picked)).weighting;

/**
 * The set with one series added or taken away — what pressing a checkbox or a tile does.
 *
 * Built by filtering SERIES_KEYS rather than by appending and sorting, so the order is the
 * table's by construction whatever order they were pressed in — which is also what keeps
 * the primary from depending on the order someone happened to tick.
 *
 * Removing the last is refused, because a chart of nothing is not a state the page has
 * anything to say in — and the refusal returns the very array it was given rather than an
 * equal one: a fresh array here would be a new context value for every card on the page
 * (see ProjectViewCtx) and a rebuilt uPlot behind each of them.
 */
export const toggledSeries = (
  picked: PickedSeries,
  key: SeriesKey,
): PickedSeries => {
  if (!picked.includes(key)) {
    return nonEmptyPick(
      SERIES_KEYS.filter((k) => k === key || picked.includes(k)),
    );
  }
  // The last one stays lit, and the same array comes back — see above.
  if (picked.length === 1) return picked;
  return nonEmptyPick(picked.filter((k) => k !== key));
};

/**
 * The set reduced to one series — what pressing a row does where only one may be lit.
 *
 * The map is the page that wants this: a pin is a badge over a place with room for a single
 * number, so a set of five there would draw one of them and drop four without saying so (see
 * primarySeries). Ticking is then choosing rather than adding, which is why that menu's rows
 * are radios and not boxes.
 *
 * The same array comes back when the pressed row is already the lit one, for the reason
 * toggledSeries hands back its argument: the pick goes into the project page's context, and
 * an equal-but-new array would be a new context value for every card and pin on it.
 */
export const onlySeries = (
  picked: PickedSeries,
  key: SeriesKey,
): PickedSeries => (picked.length === 1 && picked[0] === key ? picked : [key]);

// filter() cannot know that what it kept is non-empty, and every caller has just
// established that it is by a different argument — a key that was or wasn't already in the
// set here, a length checked against zero in the reader of a stored pick (see
// seriesSelection.ts). Asserted in the one place rather than at each of them, so the
// reasoning sits next to the type it is standing in for.
export const nonEmptyPick = (keys: readonly SeriesKey[]): PickedSeries =>
  keys as PickedSeries;

// How a metric is written where it trails a number, e.g. "87.5 dB(A) 5m". The finest
// Leq is a second live and a stored minute, which is the one place the mode shows.
const METRIC_TAGS: Record<LevelMetric, string> = {
  eq_fast: '1m',
  eq_5m: '5m',
  eq_30m: '30m',
  fmax: 'Fmax',
  peak: 'Peak',
};

export const metricTag = (metric: LevelMetric, live: boolean): string =>
  live && metric === 'eq_fast' ? '1s' : METRIC_TAGS[metric];

// The unit a level is printed in, which is the weighting spelled out.
export const weightingUnit = (weighting: Weighting): string =>
  weighting === 'A' ? 'dB(A)' : 'dB(C)';

/**
 * A series' full name — `LAeq,5m`, `LCFmax`, `LCpeak` — for a readout that prints it under
 * the number instead of tagging the number with a window (see LocationReadings), and for
 * the picker's own rows, where the name is the whole of what distinguishes a weighting's
 * row from its twin in the other block (the two share a colour by design).
 *
 * The quantity spelled out is what lets the unit go unsaid: a figure under `LAeq,5m` is dB
 * by definition and by convention, and "87.5 dB(A) 5m" repeated five times across a card is
 * the same statement three times over.
 *
 * Off the series table's own spelling rather than composed here, so a rename lands in one
 * place — the table already names all nine, and it names them for the live page. The single
 * difference between the modes is the finest window, a second live and a stored minute,
 * which is exactly what metricTag knows; so this swaps that window rather than restating
 * "LAeq" and getting to disagree with the legend about it.
 */
export const seriesLabel = (key: SeriesKey, live: boolean): string => {
  const {kind, liveLabel} = seriesByKey(key);
  return liveLabel.replace(metricTag(kind, true), metricTag(kind, live));
};

// What the Leq over the whole picked timeframe is called where a window would be named. Not
// a window and not a series — it has no line, no live counterpart and no playhead — but it is
// picked alongside them and read beside them, so it is named like them. `Range` is the
// word the page already uses for the timeframe (see coverageDetail).
const RANGE_WINDOW = 'Range';

/**
 * Its full name, for a readout that prints the quantity under the number (see seriesLabel)
 * — and for the picker's own row, which is the same name because it is the same reading.
 *
 * Weighted like everything else here, and it has to be: it is an energetic mean over one
 * weighting's minute column, so `Leq,Range` on its own would be the one row in a menu of
 * ten not saying which it was. The weighting is the primary pick's rather than a choice of
 * its own — a mean has room for exactly one, and following the primary is what every other
 * single-number readout on the page does (see primarySeries and showRangeLeq). So the row
 * is one row, and it is renamed by whatever is ticked above it.
 */
export const rangeLabel = (weighting: Weighting): string =>
  `L${weighting}eq,${RANGE_WINDOW}`;

// A series is a row of the table (seriesByKey), which carries both halves of the
// answer: `get` reads it off a live record, `col` names the stored field holding it.

/**
 * The live value for a series, off a device's newest record. Null when the device hasn't
 * filled that trailing window yet — 5m/30m only arrive once its ring buffer has.
 */
export const liveDb = (record: NoiseRecording, key: SeriesKey): number | null =>
  seriesByKey(key).get(record);

export type DisplayedLevel =
  // The latest MQTT record, recent enough to count as now.
  | {kind: 'live'; db: number}
  // A stored level: the aggregate covering the playhead's minute.
  | {kind: 'history'; db: number}
  // The last thing the live stream said before it dried up. Worth showing —
  // "it was 87.3 when we last heard" beats a blank where a number was — but it
  // is not a current reading, so callers render it muted and it never counts as
  // live for the pulse or the online dot.
  | {kind: 'stale'; db: number}
  // Nothing to show: no measurement where we looked, nothing has ever arrived
  // for this device, or a trailing window it hasn't filled.
  | {kind: 'none'};

// A level that is a reading of the instant being looked at, as opposed to a remembered
// one or none at all — which is also the only kind that carries a dB, so this narrows.
export type CurrentLevel = Extract<DisplayedLevel, {kind: 'live' | 'history'}>;

// Whether a level is a reading of right now, as opposed to a remembered one. The
// one place the distinction is spelled out, so a pin, a row and a pulse can't
// disagree about which levels are current.
export const isCurrent = (level: DisplayedLevel): level is CurrentLevel =>
  level.kind === 'live' || level.kind === 'history';

/**
 * The single decision about what level to display for one monitor, shared by the
 * map pins and the list rows so the two can't disagree.
 *
 * Live mode reads the MQTT stream, demoting its last value to `stale` once the
 * stream dries up rather than blanking it; otherwise the value is the playhead's
 * minute out of the stored payload, which the caller has already reduced to one
 * number.
 */
export function displayedLevel({
  live,
  now,
  series,
  state,
  historyDb,
}: {
  live: boolean;
  // Passed in rather than read here, so every level on a page is decided against
  // the same instant and the caller owns the tick.
  now: number;
  // Which of the page's series to read. Only the live branch needs it: the stored
  // value arrives already resolved (levelsByDevice picked the column).
  series: SeriesKey;
  // Live MQTT state for this device, if any has arrived this session.
  state?: DeviceState;
  // Stored dB for the selected series, already decoded. Undefined while it's
  // loading.
  historyDb?: number | null;
}): DisplayedLevel {
  if (live) {
    if (!state) return {kind: 'none'};
    // A window the device can't report yet reads as no level, not as a zero.
    const db = liveDb(state.latest, series);
    if (db == null) return {kind: 'none'};
    // Past the window the last record is no longer "right now" — but it is still
    // the last thing this monitor said, which is more use than a blank.
    return isFresh(state.lastSeen, now, LIVE_LEVEL_WINDOW_MS)
      ? {kind: 'live', db}
      : {kind: 'stale', db};
  }
  return historyDb != null ? {kind: 'history', db: historyDb} : {kind: 'none'};
}

/**
 * The picker's rows: every series there is, in two blocks — the four A-weighted ones, then
 * the five C-weighted — each block headed by the unit its rows are read in.
 *
 * Grouped rather than one flat list of nine, and the grouping is the whole reason a single
 * control works at all: `LAeq,5m` and `LCeq,5m` differ by one letter in the middle of a
 * name, and nine of those in a column is a list nobody can scan. Under a `dB(A)` and a
 * `dB(C)` heading the letter is the block you are in, and the rows read as the five
 * quantities twice over.
 *
 * Named in full rather than as bare windows — this used to be `Leq,5m`, with the weighting
 * left to the dropdown beside it. There is no dropdown beside it any more, and with both
 * weightings on offer at once a row that didn't say which it was would be one of a pair of
 * identical labels. Off seriesLabel, so a row, the tile that prints its number and the
 * chart's tooltip all spell it the one way.
 *
 * Every row every time, checked or not: the pick is a set, so what is *not* being drawn has
 * to be as legible as what is (see LevelPicker). And no disabled rows left — a pair the
 * table has no entry for (LCpeak's A-weighted twin) is simply not a row, where it used to
 * be a greyed one saying the *other* control was in the way.
 *
 * The finest window is one row under two labels: per-second live and per-minute stored is
 * the same intent either way ("as fine as this goes"), and the label says which you get.
 */
export const seriesOptions = (
  live: boolean,
): Array<{
  weighting: Weighting;
  unit: string;
  options: Array<{key: SeriesKey; label: string}>;
}> =>
  WEIGHTINGS.map((weighting) => ({
    weighting,
    unit: weightingUnit(weighting),
    options: SERIES_KEYS.filter(
      (key) => seriesByKey(key).weighting === weighting,
    ).map((key) => ({key, label: seriesLabel(key, live)})),
  }));

/**
 * One pin stands for a location, which may hold several monitors. The loudest is
 * what matters against a noise limit, so that's the number the pin carries.
 *
 * A current reading always wins over a remembered one, however loud the memory:
 * one monitor still reporting is what the location is doing now, and a pin that
 * preferred a louder stale value would go quiet-looking the moment it recovered.
 */
export function loudestLevel(levels: DisplayedLevel[]): DisplayedLevel {
  return levels[loudestIndex(levels)] ?? {kind: 'none'};
}

/**
 * Which of them that is, for a caller that has more to say about the winner than its
 * dB: the list row prints the loudest monitor's coverage and its second reading too,
 * and numbers picked off two different monitors would not describe anything.
 *
 * -1 when there is nothing to show, which is what makes loudestLevel above fall
 * through to `none` — the one comparison, asked two ways.
 */
export function loudestIndex(levels: DisplayedLevel[]): number {
  let best = -1;
  let winner: DisplayedLevel | undefined;
  levels.forEach((level, i) => {
    if (level.kind === 'none') return;
    const beats =
      winner == null || winner.kind === 'none'
        ? true
        : isCurrent(level) !== isCurrent(winner)
          ? isCurrent(level)
          : level.db > winner.db;
    if (beats) {
      best = i;
      winner = level;
    }
  });
  return best;
}

// One decimal everywhere a level is shown, on the map and in the list alike,
// and one dash where there is no level to show. The dash is the part worth
// centralising: a missing reading is not a quiet one, so it must never render
// as '0.0', and every site that got this right was deciding it again locally.
// `unit` is folded in so the dash doesn't come out as '— dB'.
export const formatDb = (db: number | null, unit?: string): string => {
  if (db == null) return '—';
  return unit ? `${db.toFixed(1)} ${unit}` : db.toFixed(1);
};

// A *difference* between two levels, which wants its sign shown: +3 dB and −3 dB are opposite
// findings and formatDb prints the same thing for both. Here rather than at the one call site
// so that it keeps formatDb's two decisions — one decimal, and a dash where there is nothing —
// instead of quietly forking them, which is how a tooltip ends up printing "72.3 dB" on one
// line and "+3,0 dB" on the next.
export const formatDeltaDb = (db: number | null, unit = 'dB'): string =>
  db == null ? '—' : `${db > 0 ? '+' : ''}${formatDb(db, unit)}`;
