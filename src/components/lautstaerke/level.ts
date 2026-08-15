import {type NoiseRecording} from '../../proto/noise';
import {isFresh, type DeviceState, type Weighting} from './noise';
import {hasSeries, seriesFor, type SeriesKind} from './series';

// How old a live record may be and still count as "right now". Records arrive about
// once a second, so ten seconds is several missed messages in a row. Past it the
// number is still shown — it is the last thing the monitor said — but as `stale`,
// which every caller renders muted, so it can't be read as a current level.
//
// Deliberately longer than ACTIVE_WINDOW_MS (5 s), which drives the online dot: a
// monitor that just dropped off shows a grey dot while its last number lingers a
// few seconds, rather than both vanishing on the same frame.
export const LIVE_LEVEL_WINDOW_MS = 10_000;

// Which levels the project page displays, as the two controls in its header put it: one
// frequency weighting, and a *set* of series. Page-wide, so a pin and the row beside it
// can never be showing different quantities.
//
// Every option is a SERIES kind — the very quantities the device charts plot — so a
// metric *is* one, and resolves through the series table rather than restating its
// getters and its columns. That the two coincide is the point: what is picked here is
// the set of lines the charts draw, each in its own shade off that table.
//
// Several at once because the interesting question is usually a comparison — the minute
// Leq against LAFmax, or the 5m against the 30m — and with one pick that meant working
// the dropdown back and forth and holding the last picture in your head. Every column is
// already in the browser either way (the stored payload carries all nine and so do the
// live buffers), so a second line costs a projection and not a request.
//
// The numbers beside the charts still read one of them, the *primary* — see
// primaryMetric. That split is deliberate and, for the readouts, temporary.
//
// Not every kind exists under both weightings (LCpeak has no A-weighted twin), so the
// picker offers all of them and disables the ones the weighting in force has no answer
// for — see metricOptions.
//
// The Leq over the selected timeframe is picked in the same menu and is deliberately *not*
// one of these: it has no line, no live counterpart and no playhead, so nothing downstream of
// a LevelMetric — the series table, the traces, the chart's columns — has an answer for it.
// It travels as its own flag beside this set (see useLevelPick) and is read off the cards
// only, which is why the picker's list is these five plus one row that isn't a metric.
//
// Order is load-bearing three times over: it is the order of the picker's rows, of the
// device page's tiles, and of the chart's columns (see traceColumn) — and, being
// finest-first, it is what makes primaryMetric's answer the finest thing picked.
export const LEVEL_METRICS = [
  'eq_fast',
  'eq_5m',
  'eq_30m',
  'fmax',
  'peak',
] as const satisfies readonly SeriesKind[];
export type LevelMetric = (typeof LEVEL_METRICS)[number];

/**
 * What is picked: in LEVEL_METRICS order, and never empty.
 *
 * A tuple rather than an array so the "never empty" half is the compiler's business and
 * primaryMetric needs no fallback. Only useLevelPick has to prove it, which it does by
 * being the one thing that produces these — everything downstream is handed one.
 *
 * The order is not a nicety either: the chart's columns are laid out in it (traceColumn),
 * and the first element is the metric every number on the page is read in.
 */
export type PickedMetrics = readonly [LevelMetric, ...LevelMetric[]];

/**
 * The one metric the *numbers* are read in, of however many the charts are drawing: the
 * finest of them, LEVEL_METRICS being finest-first.
 *
 * Derived rather than picked separately, so there is no second piece of state and no
 * "the primary must be one of the picked" invariant to keep. The consequence is worth
 * knowing: adding a coarser line leaves every readout where it was, and only removing
 * the finest thing you had moves them. The picker's trigger names it for that reason.
 */
export const primaryMetric = (metrics: PickedMetrics): LevelMetric =>
  metrics[0];

/**
 * The set with one metric added or taken away — what pressing a checkbox or a tile does.
 *
 * Built by filtering LEVEL_METRICS rather than by appending and sorting, so the order is
 * the table's by construction whatever order they were pressed in.
 *
 * Removing the last is refused, because a chart of nothing is not a state the page has
 * anything to say in — and the refusal returns the very array it was given rather than an
 * equal one: a fresh array here would be a new context value for every card on the page
 * (see ProjectViewCtx) and a rebuilt uPlot behind each of them.
 */
export const toggledMetrics = (
  metrics: PickedMetrics,
  metric: LevelMetric,
): PickedMetrics => {
  if (!metrics.includes(metric)) {
    return nonEmpty(
      LEVEL_METRICS.filter((m) => m === metric || metrics.includes(m)),
    );
  }
  // The last one stays lit, and the same array comes back — see above.
  if (metrics.length === 1) return metrics;
  return nonEmpty(metrics.filter((m) => m !== metric));
};

// filter() cannot know that what it kept is non-empty, and every caller here has just
// established that it is by a different argument. Asserted in the one place rather than
// at each of them, so the reasoning sits next to the type it is standing in for.
const nonEmpty = (metrics: readonly LevelMetric[]): PickedMetrics =>
  metrics as PickedMetrics;

/**
 * The set to keep when the weighting changes out from under it: whatever the new
 * weighting has a series for, and — only if that would leave nothing — the nearest kin of
 * what was dropped (see supportedMetric).
 *
 * In practice this is the one pair that doesn't exist, LCpeak under dB(A). Someone
 * watching peaks alone gets LAFmax; someone watching peaks *and* the minute Leq simply
 * loses the peak, because the rest of what they asked for is still there to draw.
 *
 * Lossy on purpose, exactly as the single-metric rule was: switching to dB(A) and back
 * does not restore the peak. Remembering it would mean carrying a pick the page is not
 * showing, which is a second kind of state for a case worth one dropdown press.
 *
 * Returns the array it was given when nothing is dropped — the identity matters for the
 * same reason it does in toggledMetrics.
 */
export const supportedMetrics = (
  metrics: PickedMetrics,
  weighting: Weighting,
): PickedMetrics => {
  const kept = metrics.filter((m) => hasSeries(m, weighting));
  if (kept.length === metrics.length) return metrics;
  if (kept.length === 0) return [supportedMetric(metrics[0], weighting)];
  return nonEmpty(kept);
};

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
 * A level's full name — `LAeq,5m`, `LCFmax`, `LCpeak` — for a readout that prints it under
 * the number instead of tagging the number with a window (see LocationReadings).
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
export const metricLabel = (
  metric: LevelMetric,
  weighting: Weighting,
  live: boolean,
): string => {
  const {liveLabel} = seriesFor(metric, weighting);
  return liveLabel.replace(metricTag(metric, true), metricTag(metric, live));
};

// What the Leq over the whole picked timeframe is called where a window would be named. Not
// a window and not a series — it has no line, no live counterpart and no playhead — but it is
// picked alongside them and read beside them, so it is named like them. `Zeitraum` is the
// word the page already uses for the timeframe (see coverageDetail).
const RANGE_WINDOW = 'Zeitraum';

/**
 * Its full name, for a readout that prints the quantity under the number (see metricLabel).
 */
export const rangeLabel = (weighting: Weighting): string =>
  `L${weighting}eq,${RANGE_WINDOW}`;

/**
 * And its name in the picker, which — like every option there — leaves the weighting to the
 * dropdown beside it, so this reads as LAeq or LCeq as selected.
 */
export const RANGE_OPTION_LABEL = `Leq,${RANGE_WINDOW}`;

// A window under a weighting is a row of the series table (seriesFor), which
// carries both halves of the answer: `get` reads it off a live record, `col` names
// the stored field holding it.

/**
 * The live value for the chosen metric, off a device's newest record. Null when the
 * device hasn't filled that trailing window yet — 5m/30m only arrive once its ring
 * buffer has.
 */
export const liveDb = (
  record: NoiseRecording,
  metric: LevelMetric,
  weighting: Weighting,
): number | null => seriesFor(metric, weighting).get(record);

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

// Whether a level is a reading of right now, as opposed to a remembered one. The
// one place the distinction is spelled out, so a pin, a row and a pulse can't
// disagree about which levels are current.
export const isCurrent = (level: DisplayedLevel): boolean =>
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
  metric,
  weighting,
  state,
  historyDb,
}: {
  live: boolean;
  // Passed in rather than read here, so every level on a page is decided against
  // the same instant and the caller owns the tick.
  now: number;
  // Which of the page's Leq windows to read, and under which weighting. Only the
  // live branch needs them: the stored value arrives already resolved (levelsByDevice
  // picked the column).
  metric: LevelMetric;
  weighting: Weighting;
  // Live MQTT state for this device, if any has arrived this session.
  state?: DeviceState;
  // Stored dB for the selected metric, already decoded. Undefined while it's
  // loading.
  historyDb?: number | null;
}): DisplayedLevel {
  if (live) {
    if (!state) return {kind: 'none'};
    // A window the device can't report yet reads as no level, not as a zero.
    const db = liveDb(state.latest, metric, weighting);
    if (db == null) return {kind: 'none'};
    // Past the window the last record is no longer "right now" — but it is still
    // the last thing this monitor said, which is more use than a blank.
    return isFresh(state.lastSeen, now, LIVE_LEVEL_WINDOW_MS)
      ? {kind: 'live', db}
      : {kind: 'stale', db};
  }
  return historyDb != null ? {kind: 'history', db: historyDb} : {kind: 'none'};
}

// The picker's rows, finest first, built off the same list and the same tag the
// numbers are printed with, so a label and the value under it can't disagree. The
// labels carry no weighting letter — that's the other dropdown — so 'Leq' reads as
// LAeq or LCeq as selected, and 'Fmax' as LAFmax or LCFmax. The finest window is one
// option under two labels: per-second live and per-minute stored is the same intent
// either way ("as fine as this goes"), and the label says which you get.
//
// Every option every time, checked or not: the picker is a set now, so what is *not*
// being drawn has to be as legible as what is (see LevelPicker).
//
// Disabled rather than dropped where the weighting has no such series: a peak is
// C-weighted by definition, and an option that vanishes reads as a bug, while a
// greyed-out one says the weighting is what's in the way.
export const metricOptions = (
  live: boolean,
  weighting: Weighting,
): Array<{value: LevelMetric; label: string; disabled?: boolean}> =>
  LEVEL_METRICS.map((value) => {
    const tag = metricTag(value, live);
    return {
      value,
      // Only the Leq windows are named after a window; the maxima are named outright.
      label: isEq(value) ? `Leq,${tag}` : tag,
      disabled: !hasSeries(value, weighting),
    };
  });

const isEq = (metric: LevelMetric) => metric.startsWith('eq_');

/**
 * The metric to fall back to when the weighting changes out from under one — LCpeak under
 * dB(A), the only pair that doesn't exist. Its nearest kin rather than the page default:
 * someone reading peaks is looking at maxima, and LAFmax is the A-weighted answer to that,
 * not the 1-minute Leq.
 *
 * About one metric, and reached only where a set has been emptied — see supportedMetrics,
 * which is what the picker actually calls.
 */
export const supportedMetric = (
  metric: LevelMetric,
  weighting: Weighting,
): LevelMetric =>
  hasSeries(metric, weighting)
    ? metric
    : hasSeries('fmax', weighting)
      ? 'fmax'
      : 'eq_fast';

// Labelled by weightingUnit rather than restating its two strings: the dropdown and
// every number printed beside it are the same decision about how a weighting is spelt.
export const WEIGHTING_OPTIONS: Array<{value: Weighting; label: string}> = (
  ['A', 'C'] as const
).map((value) => ({value, label: weightingUnit(value)}));

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
