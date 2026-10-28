import type {NoiseRecording} from '../../proto/noise';
import {exceedsLimit, type LimitLine} from './limitLines';
import {seriesByKey, type SeriesKey, type SeriesKind} from './series';

export type LimitLightState = 'ok' | 'near' | 'over' | 'recovering';

// A series limit as the light takes one — `Leq,T` limits are not among them (see the
// caller), having no reading of their own on a live page.
export type SeriesLimit = LimitLine & {series: SeriesKey};

// The windows a forecast means something for: a trailing Leq, which follows wherever the
// level goes and so can be said to be heading somewhere. A limit on the level itself
// (`Leq,1s`), on a maximum or on a peak is broken or not at the instant it is read, and has
// no later to warn about.
const FORECAST: ReadonlySet<SeriesKind> = new Set(['eq_5m', 'eq_30m']);
export const forecasts = (series: SeriesKey): boolean =>
  FORECAST.has(seriesByKey(series).kind);

// What "the current level" is: the shortest Leq there is, in the limit's own weighting — an
// LAeq,30m is heading towards the LAeq, not the LCeq. Live that is the second just gone; on
// a stored history it is the minute at the playhead, the finest it keeps.
export const currentKey = (series: SeriesKey): SeriesKey =>
  `eq_fast:${seriesByKey(series).weighting}`;

// The rule itself, over the two readings and the limit, wherever they were read from — the
// device page's latest record (see judgeLimit) or a location card's playhead (see
// LocationReadings). `current` is null where there is nothing to forecast with, which leaves
// only red or green; `db` null is nothing to judge at all.
export function limitStateOf(
  db: number | null,
  current: number | null,
  limit: number,
): LimitLightState | null {
  if (db == null) return null;
  const heading = current == null ? null : exceedsLimit(current, limit);
  return exceedsLimit(db, limit)
    ? heading === false
      ? 'recovering'
      : 'over'
    : heading === true
      ? 'near'
      : 'ok';
}

export type LimitJudgement = {
  limit: SeriesLimit;
  // The limit's own series, read off the record — what red is decided on.
  db: number | null;
  // The level now, the same weighting's Leq,1s — what amber is decided on. Null for a
  // limit with nothing to forecast (see FORECAST).
  current: number | null;
  // Null when there is nothing to judge: no current record, or a window the monitor hasn't
  // filled yet.
  state: LimitLightState | null;
};

/**
 * Where the place stands against one limit, as the light says it.
 *
 * A trailing Leq tends towards whatever level it is fed, so the level now — the Leq,1s —
 * is where the window is heading if nothing changes. Each light is one of the four pairs of
 * where the window is and where it is heading:
 *
 * - over, and heading to stay over (`over`, red);
 * - over, but the level now is under, so held there the window comes back down
 *   (`recovering`, red and amber together — on a German traffic light, the "about to go"
 *   signal, which is what it means here: still red, and on its way out of it);
 * - under, but the level now is over, so held there the window follows it up (`near`,
 *   amber);
 * - under, and the level now is under too (`ok`, green).
 *
 * Over is strictly above the limit (see exceedsLimit), for the level now as for the window.
 * That is the whole forecast, and it is deliberately no cleverer: no guess at how long
 * either way would take, which depends on what the rest of the window holds and is not the
 * question asked at the mixing desk. A limit with nothing to forecast (see FORECAST) is only
 * ever red or green.
 */
export function judgeLimit(
  limit: SeriesLimit,
  latest: NoiseRecording | null,
): LimitJudgement {
  const db = latest ? seriesByKey(limit.series).get(latest) : null;
  const current =
    latest && forecasts(limit.series)
      ? seriesByKey(currentKey(limit.series)).get(latest)
      : null;
  return {
    limit,
    db,
    current,
    state: limitStateOf(db, current, limit.decibels),
  };
}

// Over before under, and of each the one heading the wrong way first: a limit broken and
// staying broken outranks one broken and recovering, which outranks one that is only
// heading over.
const RANK: Record<LimitLightState, number> = {
  over: 3,
  recovering: 2,
  near: 1,
  ok: 0,
};

/**
 * The one limit the light answers for: of every limit in force, the one in the worst state,
 * and of those the one with the least room left under it. Overlapping limits are allowed and
 * which applies is otherwise left to the reader (see the schema), but a light has room for
 * one answer, and "fine" while any one of them is broken would be the wrong one. Ties go to
 * the first, which is the order the loader sorts them in.
 *
 * A limit with nothing to judge only decides when no other has a reading.
 */
export function decidingLimit(
  limits: readonly SeriesLimit[],
  latest: NoiseRecording | null,
): LimitJudgement | null {
  let best: LimitJudgement | null = null;
  for (const limit of limits) {
    const judged = judgeLimit(limit, latest);
    if (best == null || worse(judged, best)) best = judged;
  }
  return best;
}

const worse = (a: LimitJudgement, b: LimitJudgement): boolean => {
  if (a.state == null || a.db == null) return false;
  if (b.state == null || b.db == null) return true;
  if (RANK[a.state] !== RANK[b.state]) return RANK[a.state] > RANK[b.state];
  return a.limit.decibels - a.db < b.limit.decibels - b.db;
};

// What each state says, for anyone not looking at the glow — the badge's hover. Where it
// stands, and for the two on their way to being the other, which way it is heading: towards
// the shortest Leq of the weighting (see forecasts), which a 5- or 30-minute mean ends up at
// if nothing changes. Short, because it is a hover on a badge. Nothing for `ok`: a reading
// below its limit and staying there has no hover at all.
export const LIMIT_STATE_NAME: Record<
  Exclude<LimitLightState, 'ok'>,
  string
> = {
  over: 'Over limit',
  recovering: 'Over limit, heading below',
  near: 'Below limit, heading over',
};

// A state as the badge shows it (see ReadingTile), or null for nothing at all. Two things,
// each saying one of the two halves of the state:
// - the glow's colour is where the reading is: red over the limit, amber under it but
//   heading over — and no glow for a reading within its limit and staying there;
// - the chevron is which way it is heading, when that is not where it already is: up
//   towards the limit from under it, down away from it from over it — and the glow pulses
//   while it is, so a state on its way to being another one is the one that moves. Neither
//   for a reading over and staying over, which the steady red already says.
// The length of one beat of a badge's limit animations — the glow's pulse, the chevron's
// travel, and the name row trading the reading's name for its limit (see the limit keyframes
// in the crew theme). One length for all of them, so they can run in phase.
export const LIMIT_BEAT_MS = 1500;

// An `animation` on the limit's beat, started part-way through so that it is in phase with
// the wall clock rather than with whenever its element happened to mount: every badge on the
// page, and every animation within one, then peaks at the same instant. To be computed once
// when the animation starts (see useLimitBeat) — recomputed while it runs, the delay would
// move its phase instead of keeping it.
export const limitBeatAnimation = (
  keyframes: string,
  timing = 'ease-in-out',
): string =>
  `${keyframes} ${LIMIT_BEAT_MS}ms ${timing} ${-(Date.now() % LIMIT_BEAT_MS)}ms infinite`;

export type LimitDirection = 'up' | 'down';
export function limitGlow(
  state: LimitLightState,
): {color: string; direction: LimitDirection | null; pulse: boolean} | null {
  switch (state) {
    case 'ok':
      return null;
    case 'near':
      return {color: 'yellow.400', direction: 'up', pulse: true};
    case 'over':
      return {color: 'red.500', direction: null, pulse: false};
    case 'recovering':
      return {color: 'red.500', direction: 'down', pulse: true};
  }
}

// The glow as a shadow: inset, so the light comes in from the edges and leaves the middle —
// where the number is — dark. Two layers: a crisp ring at the edge, so the well reads as lit
// even at a glance across a field, and a wide soft one inside it that is the light falling
// in. The soft one alone washed out to a faint smudge against the badge's frame. In `em`,
// like everything in the badge, so it scales with the row.
export const glowShadow = (color: string): string => {
  const c = `var(--chakra-colors-${color.replace('.', '-')})`;
  return `inset 0 0 0 0.0625em ${c}, inset 0 0 0.75em 0.1875em ${c}`;
};
