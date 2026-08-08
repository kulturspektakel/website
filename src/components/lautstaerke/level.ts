import {type NoiseRecording} from '../../proto/noise';
import {isFresh, type DeviceState, type Weighting} from './noise';
import {seriesFor, type SeriesKind} from './series';

// How stale a live record may be and still be worth putting a number on. Records
// arrive about once a second, so ten seconds is several missed messages in a row —
// past that the reading is no longer "right now" and showing it would be a lie.
//
// Deliberately longer than ACTIVE_WINDOW_MS (5 s), which drives the online dot: a
// monitor that just dropped off shows a grey dot while its last number lingers a
// few seconds, rather than both vanishing on the same frame.
export const LIVE_LEVEL_WINDOW_MS = 10_000;

// Which level the project page displays, as the two dropdowns in its header put it:
// a frequency weighting, and an Leq window. One page-wide choice, so a pin and the
// row beside it can never be showing different quantities.
//
// The three instantaneous windows are SERIES kinds — the very quantities the device
// charts plot — so they go by those names and resolve through the series table
// instead of restating its getters and its columns. `satisfies` is what stops them
// drifting if that table is ever renamed.
export const POINT_METRICS = [
  'eq_fast',
  'eq_5m',
  'eq_30m',
] as const satisfies readonly SeriesKind[];
export type PointMetric = (typeof POINT_METRICS)[number];

// 'total' is the odd one out: the Leq over the whole selected range. It has no live
// counterpart — live is an instant, and there is no range to average over it — which
// is why the picker disables it while live, and why it is not a SERIES kind: there
// is no line to plot.
export type LevelMetric = PointMetric | 'total';

export const isPointMetric = (metric: LevelMetric): metric is PointMetric =>
  metric !== 'total';

// The unit a level is printed in, which is the weighting spelled out.
export const weightingUnit = (weighting: Weighting): string =>
  weighting === 'A' ? 'dB(A)' : 'dB(C)';

// A window under a weighting is a row of the series table (seriesFor), which
// carries both halves of the answer: `get` reads it off a live record, `col` names
// the stored field holding it.

/**
 * The live value for the chosen metric, off a device's newest record. Null when the
 * device hasn't filled that trailing window yet (5m/30m only arrive once its buffer
 * has), and for 'total', which live has no answer for.
 */
export const liveDb = (
  record: NoiseRecording,
  metric: LevelMetric,
  weighting: Weighting,
): number | null =>
  isPointMetric(metric) ? seriesFor(metric, weighting).get(record) : null;

export type DisplayedLevel =
  // The latest MQTT record, recent enough to count as now.
  | {kind: 'live'; db: number}
  // A stored level: the aggregate covering the playhead's minute, or the Leq over
  // the whole selected range, depending on which the picker asked for.
  | {kind: 'history'; db: number}
  // Nothing to show: live but gone quiet, no measurement where we looked, or a
  // trailing window the device hasn't filled.
  | {kind: 'none'};

/**
 * The single decision about what level to display for one monitor, shared by the
 * map pins and the list rows so the two can't disagree.
 *
 * Live mode reads the MQTT stream and goes blank once it dries up; otherwise the
 * value comes from the stored query the selected metric is fed by (the playhead's
 * minute, or the whole range) — which the caller has already reduced to one number.
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
    if (!state || !isFresh(state.lastSeen, now, LIVE_LEVEL_WINDOW_MS)) {
      return {kind: 'none'};
    }
    // A window the device can't report yet reads as no level, not as a zero.
    const db = liveDb(state.latest, metric, weighting);
    return db == null ? {kind: 'none'} : {kind: 'live', db};
  }
  return historyDb != null ? {kind: 'history', db: historyDb} : {kind: 'none'};
}

// The window picker's options, finest first. The labels carry no weighting letter —
// that's the other dropdown — so 'Leq' reads as LAeq or LCeq as selected. The finest
// window is one option under two labels: per-second live and per-minute stored is the
// same intent either way ("as fine as this goes"), and the label says which you get.
export const metricOptions = (
  live: boolean,
): Array<{value: LevelMetric; label: string; disabled?: boolean}> => [
  {value: 'eq_fast', label: live ? 'Leq,1s' : 'Leq,1m'},
  {value: 'eq_5m', label: 'Leq,5m'},
  {value: 'eq_30m', label: 'Leq,30m'},
  {value: 'total', label: 'Leq,Beginn–Ende', disabled: live},
];

// Labelled by weightingUnit rather than restating its two strings: the dropdown and
// every number printed beside it are the same decision about how a weighting is spelt.
export const WEIGHTING_OPTIONS: Array<{value: Weighting; label: string}> = (
  ['A', 'C'] as const
).map((value) => ({value, label: weightingUnit(value)}));

/**
 * One pin stands for a location, which may hold several monitors. The loudest is
 * what matters against a noise limit, so that's the number the pin carries.
 */
export function loudestLevel(levels: DisplayedLevel[]): DisplayedLevel {
  return levels.reduce<DisplayedLevel>(
    (best, level) =>
      level.kind !== 'none' && (best.kind === 'none' || level.db > best.db)
        ? level
        : best,
    {kind: 'none'},
  );
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
