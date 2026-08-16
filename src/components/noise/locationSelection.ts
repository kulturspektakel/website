import {orderLocations} from './projectView';

/**
 * Which locations the list is showing, remembered between visits.
 *
 * The list divides the page's height between its cards, so which places are on it is the
 * one decision that governs how readable the whole view is — and it used to be forgotten
 * the moment you took the map and came back. A dozen stages meant a dozen quarter-height
 * charts every time. It is per project and per browser, which is why it lives in
 * localStorage rather than in the URL or the database: it is how *you* are watching *this*
 * festival, not something to link to or to impose on the next person to open the page.
 *
 * Stored as the set that is *on*, not the set that is off. That is the difference between
 * remembering a selection and remembering an exclusion: a location placed after the fact
 * is not one you picked, so it arrives unlit in the roster and on the map rather than
 * pushing itself onto a list you had already arranged.
 */
const STORAGE_PREFIX = 'noiseLocations:';

/**
 * One location handed to the list by whatever navigated there — a pin on the map, the place
 * chip on a monitor's page. It rides in the history entry rather than in the URL because it
 * is not a fact about the page: it is the last thing you pressed. The list it lands on is
 * the same list either way, and a link carrying it would promise the next person a view
 * they had not arranged.
 *
 * Declared here, beside the selection it goes on to become, so there is one place that says
 * what the list can be told from outside.
 */
declare module '@tanstack/history' {
  interface HistoryState {
    focusLocation?: string;
  }
}

// How many places a fresh browser starts on. Three cards is about what a laptop can show
// and still leave each chart tall enough to read; the rest are one press away in the
// roster underneath.
const DEFAULT_SHOWN = 3;

const storageKey = (projectId: string) => `${STORAGE_PREFIX}${projectId}`;

type Location = {id: string; locationName: string};

// The first few, in the order locations are shown in — so what a project opens on is
// whatever compareLocations puts at the top, and changing that rule changes this too.
export function defaultSelection(locations: readonly Location[]): string[] {
  return orderLocations(locations)
    .slice(0, DEFAULT_SHOWN)
    .map((l) => l.id);
}

/**
 * What is on the list: what was stored, or the default when nothing ever was.
 *
 * Stored ids are filtered against the locations that exist, so a place deleted while the
 * selection remembered it simply drops out. Filtering the current locations rather than
 * mapping the stored ids also means the result comes back in display order, whatever
 * order the ids were written in.
 *
 * Nothing at all falls back to the default — and so does a stored selection that resolves
 * to nothing, which is the same invariant the toggle below keeps: the list always has a
 * card on it. There are three ways to arrive at empty and none of them is a choice worth
 * restoring — a browser that has never picked, an entry written before the toggle refused
 * to empty the list, and a stored arrangement whose every place has since been deleted. An
 * empty list is a view with nothing in it and no clue that the control at its foot is what
 * fills it.
 */
// A set of ids as the list would render it: display order, and only the places that still
// exist. Both readers below answer with one of these and differ only in what they fall back
// to when it comes out empty, so the rule — which is really two rules, orderLocations' and
// "drop the ghosts" — is written here rather than at each of them.
const orderedIds = (
  chosen: ReadonlySet<string>,
  locations: readonly Location[],
): string[] =>
  orderLocations(locations)
    .filter((l) => chosen.has(l.id))
    .map((l) => l.id);

export function resolveSelection(
  stored: readonly string[] | null,
  locations: readonly Location[],
): string[] {
  if (stored == null) return defaultSelection(locations);
  const ids = orderedIds(new Set(stored), locations);
  return ids.length > 0 ? ids : defaultSelection(locations);
}

/**
 * A place pressed in the roster: on the list if it was off, off if it was on — except that
 * the last one stays.
 *
 * Ignored rather than refused, and the row stays tickable to be ignored: a whole menu of
 * places with one greyed row reads as if that row were unavailable, when what is true is
 * the opposite — it is the only one being shown. Pressing it simply leaves it ticked, which
 * is also what a list of one means. (The windows picker settles the same question the same
 * way — see toggledMetrics.)
 *
 * Answers with the ids in display order and only the places that still exist, which is
 * both what the list renders and what is worth storing: an arrangement rather than a set
 * with the ghosts of deleted locations in it.
 */
export function toggledSelection(
  selected: ReadonlySet<string>,
  locationId: string,
  locations: readonly Location[],
): string[] {
  const next = new Set(selected);
  if (!next.delete(locationId)) next.add(locationId);
  const ids = orderedIds(next, locations);
  // Empty means the press was the last card's — everything else in the set was a ghost —
  // so the answer is the list as it stood, which is that one place.
  return ids.length > 0 ? ids : [locationId];
}

/**
 * The selection a location handed over amounts to: that one place and nothing else.
 *
 * Alone on the list, not added to it — someone who pressed a pin asked about *that* stage,
 * and the answer is worth the whole page rather than a quarter of it beside three cards
 * they last arranged for a different question. It becomes the remembered arrangement like
 * any other (the caller stores it), so going back to the map and returning finds it still
 * there.
 *
 * Null when nothing was handed over, and equally when what was named no longer exists — a
 * link followed to a place deleted since is a list with nothing to say about it, so the
 * stored selection stands.
 */
export function focusSelection(
  focus: string | undefined,
  locations: readonly Location[],
): string[] | null {
  if (focus == null) return null;
  return locations.some((l) => l.id === focus) ? [focus] : null;
}

/**
 * What a stored string means, or null when it means nothing usable.
 *
 * Null for every kind of nothing: no key at all, a value from a version that wrote
 * something else, a half-written string. A page that threw on a bad localStorage entry
 * would be a page nobody could open again without knowing about devtools, and the cost of
 * being wrong here is three cards instead of the ones you picked.
 *
 * Separate from the read below so the rule can be tested without a browser — the storage
 * call is then only a storage call.
 */
export function parseSelection(raw: string | null): string[] | null {
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.every((id) => typeof id === 'string')
      ? (parsed as string[])
      : null;
  } catch {
    return null;
  }
}

// The window guard is for the server render — see the list view for why the call is made
// after mount rather than during it.
export function readSelection(projectId: string): string[] | null {
  if (typeof window === 'undefined') return null;
  return parseSelection(window.localStorage.getItem(storageKey(projectId)));
}

// Written on every toggle, so the last arrangement is the one that comes back. A full
// storage (or a browser refusing it altogether) costs the memory, not the page.
export function writeSelection(
  projectId: string,
  ids: readonly string[],
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(ids));
  } catch {
    // ignore
  }
}
