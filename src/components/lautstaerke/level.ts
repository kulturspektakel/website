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

// Which level the project page displays, as the two dropdowns in its header put it:
// a frequency weighting, and a series. One page-wide choice, so a pin and the row
// beside it can never be showing different quantities.
//
// Every option is a SERIES kind — the very quantities the device charts plot — so a
// metric *is* one, and resolves through the series table rather than restating its
// getters and its columns. That the two coincide is the point: what is picked here is
// the line the row charts draw, and the number is printed in that line's colour.
//
// Not every kind exists under both weightings (LCpeak has no A-weighted twin), so the
// picker offers all of them and disables the ones the weighting in force has no answer
// for — see metricOptions.
//
// The Leq over the selected range used to be an option too. It isn't one any more: it
// has no line, no live counterpart and no playhead, and it is what one wants to read
// off *every* row anyway — so the rows show it by default and the picker is left
// meaning one thing only.
export const LEVEL_METRICS = [
  'eq_fast',
  'eq_5m',
  'eq_30m',
  'fmax',
  'peak',
] as const satisfies readonly SeriesKind[];
export type LevelMetric = (typeof LEVEL_METRICS)[number];

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

// The picker's options, finest first, built off the same list and the same tag the
// numbers are printed with, so a label and the value under it can't disagree. The
// labels carry no weighting letter — that's the other dropdown — so 'Leq' reads as
// LAeq or LCeq as selected, and 'Fmax' as LAFmax or LCFmax. The finest window is one
// option under two labels: per-second live and per-minute stored is the same intent
// either way ("as fine as this goes"), and the label says which you get.
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
 * The metric to fall back to when the weighting changes out from under the picked one
 * — LCpeak under dB(A), the only pair that doesn't exist. Its nearest kin rather than
 * the page default: someone reading peaks is looking at maxima, and LAFmax is the
 * A-weighted answer to that, not the 1-minute Leq.
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
