import {useCallback, useEffect, useState} from 'react';

/**
 * How many columns the list view lays its cards out in, remembered between visits.
 *
 * It was a search param first, on the theory that the arrangement is part of what you are
 * looking at. It isn't: the count answers how big the screen in front of you is — a phone, a
 * laptop, the wall display a control room runs this on — and that is not a fact about the
 * project worth sending to anybody. What it cost as a param was a URL that carried a layout
 * into every link, and a trip to the map that came back at one column because the map's URL
 * has nowhere to keep it.
 *
 * So it is stored, like which places are on the list — but stored differently, and this is
 * the one thing to know about the pair: the selection is per project (see
 * locationSelection.ts), because which stages you are watching is a decision about *that*
 * festival, while the column count is per browser, because the screen is the same screen
 * whichever project is open on it.
 */
const STORAGE_KEY = 'noiseColumns';

// The counts offered, in the order the picker offers them. One is the default and the narrow
// screen's only sensible answer; three is for that wall display, where a dozen stages at
// full width would be a page nobody scrolls. Four is not offered because a quarter-width
// chart is about as wide as its own dB axis is tall.
export const COLUMNS = [1, 2, 3] as const;

export type Columns = (typeof COLUMNS)[number];

const DEFAULT_COLUMNS: Columns = 1;

/**
 * What a stored string means, or null when it means nothing usable — no key, a count from a
 * version that offered more of them, anything that isn't one of the counts at all.
 *
 * Separate from the read below so the rule can be tested without a browser, and null rather
 * than a throw for the same reason it is in locationSelection: the cost of being wrong here
 * is a column, and a page that threw on a stale localStorage entry would be one nobody could
 * open again without knowing about devtools.
 */
export function parseColumns(raw: string | null): Columns | null {
  const cols = Number(raw);
  return COLUMNS.find((n) => n === cols) ?? null;
}

// The window guard is for the server render — see the hook below for why the call is made
// after mount rather than during it.
function readColumns(): Columns | null {
  if (typeof window === 'undefined') return null;
  return parseColumns(window.localStorage.getItem(STORAGE_KEY));
}

// Written on every pick, so the last arrangement is the one that comes back. A full storage
// (or a browser refusing it altogether) costs the memory, not the page.
function writeColumns(cols: Columns): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(cols));
  } catch {
    // ignore
  }
}

/**
 * The count as state a view can own, and the pick that both sets and stores it.
 *
 * The stored value is read after mount rather than in the initializer, and that is the whole
 * reason there is an effect: the page is server-rendered, and a lazy initializer reading
 * localStorage would hand hydration a different grid than the server sent. One column is on
 * screen for the frame in between — same arrangement the location selection uses, and for
 * the same reason.
 */
export function useListColumns(): [Columns, (cols: Columns) => void] {
  const [columns, setColumns] = useState<Columns>(DEFAULT_COLUMNS);

  useEffect(() => {
    const stored = readColumns();
    if (stored != null) setColumns(stored);
  }, []);

  const pick = useCallback((next: Columns) => {
    setColumns(next);
    writeColumns(next);
  }, []);

  return [columns, pick];
}
