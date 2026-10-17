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
