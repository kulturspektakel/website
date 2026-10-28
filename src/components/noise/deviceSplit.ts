import {useCallback, useEffect, useState, type RefObject} from 'react';

/**
 * How tall the device page's row of readings is against the charts under it, remembered
 * between visits — per browser, like the list's column count (see listColumns.ts), because
 * it answers how big the screen is and how far away it is being read from, not anything
 * about the monitor.
 *
 * Stored as pixels together with the size of the box it was dragged in, and only trusted
 * back in a box about that size. A split is a decision about one window: the row dragged
 * tall on a wall display, brought back on a laptop, would leave the charts a strip; and the
 * same height in a window resized by a little is still the arrangement that was made. So
 * within TOLERANCE of the stored size either way the height comes back, and outside it the
 * entry is thrown away and the page opens on its default — the honest answer for a screen
 * nobody has arranged yet.
 */
const STORAGE_KEY = 'noiseDeviceSplit';

// How far the box may have moved, as a share of what it was, before a stored split no longer
// describes it. A tenth: a browser's toolbar shown or hidden, a dock appearing, survive it; a
// different screen does not.
const TOLERANCE = 0.1;

export type StoredSplit = {
  // The readings row, in px.
  readings: number;
  // The box both rows share, in px, when the split was made.
  width: number;
  height: number;
};

/**
 * What a stored string means, or null when it means nothing usable. Separate from the read
 * below so the rule can be tested without a browser, and null rather than a throw for the
 * reason the other stored preferences give (see parseColumns): a stale entry must cost the
 * memory, never the page.
 */
export function parseSplit(raw: string | null): StoredSplit | null {
  if (raw == null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value == null) return null;
    const {readings, width, height} = value as Record<string, unknown>;
    if (
      typeof readings !== 'number' ||
      typeof width !== 'number' ||
      typeof height !== 'number' ||
      !(readings > 0) ||
      !(width > 0) ||
      !(height > readings)
    ) {
      return null;
    }
    return {readings, width, height};
  } catch {
    return null;
  }
}

/**
 * The stored readings height, as a share of the box it would be applied in, or null where
 * the box has changed enough that the stored one no longer describes it (see TOLERANCE).
 * A percentage because that is what the splitter is controlled in.
 */
export function splitFor(
  stored: StoredSplit,
  box: {width: number; height: number},
): number | null {
  const moved = (now: number, then: number) =>
    Math.abs(now - then) / then > TOLERANCE;
  if (moved(box.width, stored.width) || moved(box.height, stored.height)) {
    return null;
  }
  return (stored.readings / box.height) * 100;
}

const read = (): StoredSplit | null =>
  typeof window === 'undefined'
    ? null
    : parseSplit(window.localStorage.getItem(STORAGE_KEY));

// A full storage, or a browser refusing it altogether, costs the memory and not the page.
const write = (split: StoredSplit | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (split) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(split));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

/**
 * The splitter's sizes as state, starting on `fallback` and moved to the stored split once
 * the box can be measured — after mount, since the page is server-rendered and the box has
 * no size before it is laid out (the same one-frame arrangement useListColumns makes).
 * A stored split the box has outgrown is removed there and then, so it is not weighed again
 * on every visit.
 *
 * `onResize` keeps the state with the drag; `onResizeEnd` is where it is stored, once per
 * drag rather than once per pointer move — and only for a drag or a key press on the
 * divider, which is what a trigger id says. The splitter calls it for its own changes too
 * (laying out the default on mount, re-flowing after a resize of the window), and storing
 * those would overwrite the arrangement someone made with one nobody did, before the effect
 * above had read it.
 */
export function useDeviceSplit(
  box: RefObject<HTMLElement | null>,
  fallback: (string | number)[],
): {
  size: (string | number)[];
  onResize: (details: {size: number[]}) => void;
  onResizeEnd: (details: {
    size: number[];
    resizeTriggerId: string | null;
  }) => void;
} {
  const [size, setSize] = useState<(string | number)[]>(fallback);

  useEffect(() => {
    const element = box.current;
    const stored = read();
    if (!element || !stored) return;
    const share = splitFor(stored, {
      width: element.clientWidth,
      height: element.clientHeight,
    });
    if (share == null) {
      write(null);
      return;
    }
    setSize([share, 100 - share]);
    // Once, on arriving: after that the drag is what moves it.
  }, []);

  const onResize = useCallback(({size}: {size: number[]}) => setSize(size), []);
  const onResizeEnd = useCallback(
    ({
      size,
      resizeTriggerId,
    }: {
      size: number[];
      resizeTriggerId: string | null;
    }) => {
      const element = box.current;
      if (resizeTriggerId == null || !element || size[0] == null) return;
      const height = element.clientHeight;
      write({
        readings: (size[0] / 100) * height,
        width: element.clientWidth,
        height,
      });
    },
    [box],
  );

  return {size, onResize, onResizeEnd};
}
