import {nonEmptyPick, type PickedSeries} from './level';
import {SERIES_KEYS, type SeriesKey} from './series';

/**
 * What a page's level menu is set to, remembered between visits: which series its charts
 * draw, and whether the crop's Leq is printed beside them.
 *
 * Not in the URL, for the reason the column count is not (see listColumns.ts): the pick is
 * how you read a chart rather than what you are looking at, and a param would carry one
 * reader's habit into every link. Per browser rather than per project for the same reason —
 * whoever watches LCpeak watches it at every festival — so the key names the page and
 * nothing else.
 *
 * One key per page, and that is the whole point of this file: the three pages that pick
 * series are asking different questions of them, so they must not share an answer. A
 * monitor's live page is an instrument — five lines at once is what it is for; the list is a
 * page of charts, and the pick is what each of them draws; the map has room for one number
 * per pin, so it stores exactly one (see `single` below), and a set of five arriving there
 * from the list would have four of them silently unread. Storing them together meant a trip
 * to the map came back with the map's pick on the cards.
 *
 * Both halves of the menu in one entry, because they are one menu: the timeframe's Leq is
 * ticked in the same list as the series and is as much a decision about how you read the
 * page, so remembering the nine rows and forgetting the tenth would leave the one row that
 * came back the way it started.
 */
const STORAGE_PREFIX = 'noiseSeries:';

// The pages that remember a pick, one key each. Named rather than spelled at the call sites
// so the three strings are written down once, together, where it is legible that they are
// three and not one.
export const SERIES_STORE = {
  device: 'device',
  list: 'project.list',
  map: 'project.map',
} as const;

export type SeriesStore = (typeof SERIES_STORE)[keyof typeof SERIES_STORE];

// What the menu is set to: the lines, and the timeframe's Leq beside them. The shape the hook
// holds and the shape that is stored, so there is one statement of what a remembered menu is.
export type StoredPick = {
  picked: PickedSeries;
  rangeLeq: boolean;
};

// What a page opens on before anything has been picked, and what a stored value that means
// nothing falls back to: the everyday series, and the crop's Leq on — which is what the two
// were when neither was remembered. `picked` is a tuple, so it is a PickedSeries by
// construction, and one array rather than a fresh one per read, since a pick that has not
// changed coming back as the same array is what keeps the charts from being rebuilt (see
// toggledSeries). Nothing mutates a pick: every producer of one builds a new array (see
// toggledSeries, onlySeries).
export const DEFAULT_PICK: StoredPick = {
  picked: ['eq_fast:A'],
  rangeLeq: true,
};

const storageKey = (store: SeriesStore) => `${STORAGE_PREFIX}${store}`;

// The series of a stored list, in SERIES_KEYS order and filtered to the ones that still
// exist — the same rule toggledSeries keeps, so a stored pick and a picked one are the same
// kind of thing and the primary is the finest of them either way (see primarySeries). Null
// when nothing recognisable is left, a pick being never empty.
//
// `single` truncates rather than rejecting: a page with room for one number wants the first
// of whatever was written, not a fallback to dB(A) because another version of the page — an
// older one, or the list next door — wrote two.
function storedSeries(value: unknown, single: boolean): PickedSeries | null {
  if (!Array.isArray(value)) return null;
  const stored = new Set(
    value.filter((k): k is string => typeof k === 'string'),
  );
  const keys = SERIES_KEYS.filter((key) => stored.has(key));
  const picked = single ? keys.slice(0, 1) : keys;
  return picked.length > 0 ? nonEmptyPick(picked) : null;
}

/**
 * What a stored string means, or null when it means nothing usable.
 *
 * Null for every kind of nothing — no key, a value from a version that spelled series
 * differently, a half-written string, an empty list — because a page that threw on a stale
 * localStorage entry would be one nobody could open again without devtools, and the cost of
 * being wrong here is a chart drawn in dB(A).
 *
 * The series decide it: an entry whose lines are unreadable is not worth mining for its
 * `range` flag, since the menu it describes is being fallen back to wholesale. A missing or
 * non-boolean flag is the default rather than a rejection, which is also what makes the bare
 * array an earlier version of this file wrote still readable — the lines survive an upgrade,
 * and the tenth row starts where it always did.
 *
 * Separate from the read below so the rule can be tested without a browser, which is also
 * why it takes the raw string.
 */
export function parseStoredPick(
  raw: string | null,
  single = false,
): StoredPick | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record =
    typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  const picked = storedSeries(record ? record.series : parsed, single);
  if (picked == null) return null;
  return {
    picked,
    rangeLeq:
      typeof record?.range === 'boolean' ? record.range : DEFAULT_PICK.rangeLeq,
  };
}

// The window guard is for the server render — see useLevelPick for why the call is made
// after mount rather than during it.
export function readStoredPick(
  store: SeriesStore,
  single = false,
): StoredPick | null {
  if (typeof window === 'undefined') return null;
  return parseStoredPick(
    window.localStorage.getItem(storageKey(store)),
    single,
  );
}

// Written on every press in the menu, so the last state of it is the one that comes back. A
// full storage (or a browser refusing it altogether) costs the memory, not the page.
export function writeStoredPick(
  store: SeriesStore,
  {picked, rangeLeq}: {picked: readonly SeriesKey[]; rangeLeq: boolean},
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      storageKey(store),
      JSON.stringify({series: picked, range: rangeLeq}),
    );
  } catch {
    // ignore
  }
}
