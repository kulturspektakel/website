import {useEffect} from 'react';

// Whether the page's playhead is pinned: set by a click, it stays put while the pointer moves
// over any chart or the timeline, until the next click there lets it follow the pointer again.
// One flag for the whole page, on the root element, because the playhead is one instant drawn
// on every chart and the timeline at once: pinned on one, it is pinned on all of them, and
// each of them — the hover that would move it and the mark that draws it (see
// PINNED_PLAYHEAD_CSS) — reads the flag from the same place.
const PINNED_ATTR = 'data-playhead-pinned';

export function isPlayheadPinned(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.hasAttribute(PINNED_ATTR)
  );
}

export function setPlayheadPinned(pinned: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.toggleAttribute(PINNED_ATTR, pinned);
}

// What Space does for itself where it lands: types a space in a field, presses a button,
// ticks a box, opens a menu. Pressed on any of these it is that control's, not the page's.
const SPACE_TAKEN_BY =
  'input, textarea, select, button, a[href], summary, [contenteditable=""], [contenteditable="true"], [role="button"], [role="checkbox"], [role="switch"], [role="radio"], [role="menuitem"], [role="option"], [role="tab"], [role="combobox"]';

// Space pins the playhead where it is, or lets a pinned one go to follow the pointer again —
// the same toggle a click on a chart or the timeline makes, without moving it first. Pinning
// from the keyboard is the point: the pointer is resting where the reading is wanted, and a
// click there would be one more thing for it to do.
//
// On the window, for the reason the charts' `i` and `o` are (see LevelTrace): what is being
// pointed at is a canvas, which nothing focuses. Not while `enabled` is false — live, where
// the playhead is now's and there is nothing to pin, and while the map is being edited, when
// it holds still anyway — and never inside a dialog, which is its own page while it is up.
export function usePlayheadPinKey(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)
        return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(SPACE_TAKEN_BY) || target?.closest('[role="dialog"]'))
        return;
      // Taken even when held down, so the page under it doesn't start scrolling — but
      // toggled only once per press, or holding it would flicker the pin.
      e.preventDefault();
      if (e.repeat) return;
      setPlayheadPinned(!isPlayheadPinned());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

// Spread into a playhead mark's own styles — the hairline with its head drawn by
// playheadHead's two pseudo-elements, on the charts and on the timeline alike. While it
// follows the pointer it is a cursor: faint, and no head. Once a click has set it, it is the
// full mark, which is what says "this is the instant being read" rather than "this is where
// the hand is".
export const PINNED_PLAYHEAD_CSS = {
  [`html:not([${PINNED_ATTR}]) &`]: {
    opacity: 0.5,
    '&::before, &::after': {display: 'none'},
  },
} as const;
