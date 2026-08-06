import {decodeDb, isFresh, type DeviceState} from './noise';

// How stale a live record may be and still be worth putting a number on. Records
// arrive about once a second, so ten seconds is several missed messages in a row —
// past that the reading is no longer "right now" and showing it would be a lie.
//
// Deliberately longer than ACTIVE_WINDOW_MS (5 s), which drives the online dot: a
// monitor that just dropped off shows a grey dot while its last number lingers a
// few seconds, rather than both vanishing on the same frame.
export const LIVE_LEVEL_WINDOW_MS = 10_000;

export type DisplayedLevel =
  // The latest MQTT record, recent enough to count as now.
  | {kind: 'live'; db: number}
  // The stored aggregate covering the playhead's minute.
  | {kind: 'history'; db: number}
  // Nothing to show: live but gone quiet, or no measurement at the playhead.
  | {kind: 'none'};

/**
 * The single decision about what level to display for one monitor, shared by the
 * map pins and the list rows so the two can't disagree.
 *
 * Live mode reads the MQTT stream and goes blank once it dries up; otherwise the
 * value comes from the stored minute the playhead sits in.
 */
export function displayedLevel({
  live,
  now,
  state,
  historyDb,
}: {
  live: boolean;
  // Passed in rather than read here, so every level on a page is decided against
  // the same instant and the caller owns the tick.
  now: number;
  // Live MQTT state for this device, if any has arrived this session.
  state?: DeviceState;
  // Stored dB at the playhead, already decoded. Undefined while it's loading.
  historyDb?: number | null;
}): DisplayedLevel {
  if (live) {
    return state && isFresh(state.lastSeen, now, LIVE_LEVEL_WINDOW_MS)
      ? {kind: 'live', db: decodeDb(state.latest.laeq)}
      : {kind: 'none'};
  }
  return historyDb != null ? {kind: 'history', db: historyDb} : {kind: 'none'};
}

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

// One decimal everywhere a level is shown, on the map and in the list alike.
export const formatDb = (db: number): string => db.toFixed(1);
