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
 * An empty stored array is a selection like any other — the list says so ("Kein Standort
 * ausgewählt") and reloading must not quietly put three cards back. Only `null`, meaning
 * this browser has never chosen, falls back to the default; that is what keeps the rule
 * above free to change without overriding anyone's choice.
 *
 * Stored ids are filtered against the locations that exist, so a place deleted while the
 * selection remembered it simply drops out. Filtering the current locations rather than
 * mapping the stored ids also means the result comes back in display order, whatever
 * order the ids were written in.
 */
export function resolveSelection(
  stored: readonly string[] | null,
  locations: readonly Location[],
): string[] {
  if (stored == null) return defaultSelection(locations);
  const chosen = new Set(stored);
  return orderLocations(locations)
    .filter((l) => chosen.has(l.id))
    .map((l) => l.id);
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
