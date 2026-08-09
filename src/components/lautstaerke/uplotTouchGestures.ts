import type uPlot from 'uplot';

// Touch on a uPlot chart, which uPlot itself does not do: it binds mousedown, mousemove
// and mouseup and nothing else, so a tap gets whatever compatibility mouse event the
// browser decides to synthesise and a drag gets nothing at all. Adapted from uPlot's
// zoom-touch demo, x-only, and with the fingers divided differently:
//
//   one finger  — the cursor. A tap or a horizontal drag reads the trace, exactly as a
//                 mouse hover does: tooltip, playhead, the page's numbers. The window
//                 does not move, because the thing you point at with one finger on a
//                 chart of an evening is a moment in it.
//   two fingers — the window. A pinch changes how much of the evening is on screen, a
//                 two-finger drag slides it. Both clamped to `bounds`.
//
// A plain function rather than a hook, called from inside the chart's own create effect
// and torn down alongside the plot, so the listener lifetime is exactly the plot's.

// Never zoom in past a one-minute window: the stored trace is one point per minute, so
// below this there is nothing further to resolve.
export const MIN_RANGE_S = 60;
// Pixels of finger spread below which the ratio isn't worth trusting — and, being the
// floor of a divisor, what keeps two fingers landing on one pixel from dividing by zero.
const MIN_FINGER_SPREAD = 1;

// How far one finger must travel before its direction is taken as meant. Roughly a
// chart's drag threshold: below this a gesture is a hand not quite still, and guessing
// its axis would either eat a scroll or refuse one.
export const LOCK_PX = 6;

// What a single finger turned out to be doing. Decided once per gesture, from the first
// movement past LOCK_PX, and then held — so a scrub that drifts downwards keeps
// scrubbing and a scroll that drifts sideways keeps scrolling, which is what makes
// either gesture usable on a list of cards.
export type TouchLock = 'scrub' | 'scroll' | null;

/**
 * Which axis a one-finger drag committed to, or null while it is still too small to say.
 *
 * Ties go to scrolling: the list is the page's own gesture, and a finger that has moved
 * exactly as far down as across is likelier reaching for the next card than for a
 * reading. Exported for its own test — the arithmetic is trivial, the rule is not.
 */
export function lockAxis(dx: number, dy: number): TouchLock {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < LOCK_PX) return null;
  return ax > ay ? 'scrub' : 'scroll';
}

/**
 * The window a two-finger gesture asks for, in the x-scale's units.
 *
 * The gesture is anchored once (see `anchor` below) and every frame is measured against
 * that anchor rather than against the frame before it, so a pinch that wanders is still
 * the ratio between where the fingers started and where they are — no drift, and letting
 * go and starting again is the only way to re-anchor.
 *
 *   `spreadRatio`   the fingers' starting spread over their current one: > 1 zooms in
 *                   (they moved apart), < 1 out, and exactly 1 for a two-finger drag,
 *                   which is what makes a pan a pinch that didn't pinch.
 *   `anchorVal`     the value under the fingers' midpoint when the gesture began, which
 *                   stays under it — the pinch's fixed point.
 *   `midPct`        where the midpoint now sits across the plot, so that fixed point
 *                   travels with the fingers rather than the window growing about a
 *                   corner.
 *
 * Clamped in width first and then in position, and the position clamp *slides* rather
 * than squashes: a window pushed off the end of the project keeps the width the fingers
 * asked for and stops against the edge. A pinch is a statement about how much you want
 * to see, and honouring it at the edge is what keeps the two ends of the strip usable.
 *
 * Pure, and exported for the test: everything here is off-by-one country.
 */
export function pinchWindow({
  anchorSpan,
  anchorVal,
  midPct,
  spreadRatio,
  bounds,
}: {
  anchorSpan: number;
  anchorVal: number;
  midPct: number;
  spreadRatio: number;
  bounds: [number, number];
}): {min: number; max: number} {
  const [boundsMin, boundsMax] = bounds;
  const boundsSpan = boundsMax - boundsMin;
  const span = Math.min(
    Math.max(anchorSpan * spreadRatio, MIN_RANGE_S),
    // A window wider than the project is not a view of anything more, and the clamp
    // below would only push it back to the same place.
    boundsSpan,
  );
  let min = anchorVal - midPct * span;
  let max = min + span;
  if (min < boundsMin) [min, max] = [boundsMin, boundsMin + span];
  if (max > boundsMax) [min, max] = [boundsMax - span, boundsMax];
  return {min, max};
}

export function attachTouchGestures(
  plot: uPlot,
  {
    bounds,
    onRange,
    onScrub,
  }: {
    // How far a pan or a pinch may reach, in the x-scale's units. Read fresh every
    // frame, and deliberately not the chart's own extent: the chart is already showing a
    // crop, so clamping to what it shows would leave a pinch nothing to widen into and a
    // pan nowhere to go.
    bounds: () => [number, number];
    // The window the fingers are asking for, at most once per animation frame — the last
    // frame of a gesture included, because a pending frame still fires after the fingers
    // are off. So there is no separate commit: every frame is one.
    onRange: (min: number, max: number) => void;
    // Where one finger is, in the plot area's own pixels, or null to put the cursor away
    // — which is what a lifted finger, a gesture handed to the scroller, and a second
    // finger landing all amount to.
    onScrub: (pos: {left: number; top: number} | null) => void;
  },
): () => void {
  const over = plot.over;
  // Vertical scrolling stays the browser's, so a list of cards is still a list you can
  // scroll with a finger on a chart. Everything else is ours: `pan-y` also rules out the
  // browser's own pinch-zoom, which is what leaves the two-finger gesture free to be the
  // chart's. Not `none`, which would take the scroll with it.
  over.style.touchAction = 'pan-y';

  // Finger midpoint x (px, relative to the plot area) and the spread `d` between two
  // fingers — 1 for a single finger, so the ratio stays 1 and a one-finger gesture could
  // never zoom even if it reached this arithmetic.
  const fr = {x: 0, d: 1};
  const to = {x: 0, d: 1};
  let rect = over.getBoundingClientRect();
  let anchorSpan = 0;
  let anchorVal = 0;

  // Where a single finger is, clamped into the plot area: uPlot reads a cursor position
  // as a pixel inside the plot, and a finger a little over the edge of a row-height chart
  // means the first or the last sample rather than no sample at all.
  const scrubPos = (touch: Touch) => ({
    left: Math.min(Math.max(touch.clientX - rect.left, 0), rect.width),
    top: Math.min(Math.max(touch.clientY - rect.top, 0), rect.height),
  });

  const storePos = (t: {x: number; d: number}, e: TouchEvent) => {
    const t0 = e.touches[0];
    if (!t0) return;
    const t0x = t0.clientX - rect.left;
    const t1 = e.touches[1];
    if (!t1) {
      t.x = t0x;
      t.d = 1;
    } else {
      const t1x = t1.clientX - rect.left;
      t.x = (t0x + t1x) / 2;
      t.d = Math.max(Math.abs(t1x - t0x), MIN_FINGER_SPREAD);
    }
  };

  // Re-anchor the gesture to the current scale and finger positions. Called on
  // touchstart and whenever the finger count changes mid-gesture, so `fr.d` and `to.d`
  // are always measured with the same number of fingers — otherwise lifting one finger
  // collapses `to.d` to 1 and zooms way out.
  let anchoredCount = 0;
  const anchor = (e: TouchEvent) => {
    rect = over.getBoundingClientRect();
    storePos(fr, e);
    anchoredCount = e.touches.length;
    const {min, max} = plot.scales.x;
    anchorSpan = (max ?? 0) - (min ?? 0);
    anchorVal = plot.posToVal(fr.x, 'x');
  };

  let rafPending = false;
  const applyRange = () => {
    rafPending = false;
    const {min, max} = pinchWindow({
      anchorSpan,
      anchorVal,
      midPct: rect.width > 0 ? to.x / rect.width : 0,
      spreadRatio: fr.d / to.d,
      bounds: bounds(),
    });
    onRange(min, max);
  };

  // The one-finger gesture: where it started, and what it turned out to be. `lock` stays
  // null until the finger has moved far enough to say, and during that time the finger
  // scrubs — a tap has to read the trace immediately, and a tap is a gesture that never
  // locks at all.
  let start: {x: number; y: number} | null = null;
  let lock: TouchLock = null;

  const onStart = (e: TouchEvent) => {
    rect = over.getBoundingClientRect();
    if (e.touches.length === 1) {
      const t0 = e.touches[0]!;
      // No preventDefault: until this finger has picked a direction the scroller may
      // still want it, and a cancelled touchstart is a card list that cannot be
      // scrolled from the chart that covers it.
      start = {x: t0.clientX, y: t0.clientY};
      lock = null;
      onScrub(scrubPos(t0));
      return;
    }
    // A second finger means the window, not the trace. Take the gesture — the browser
    // has no use for it under `pan-y` anyway — and put the cursor away, so the tooltip
    // isn't left standing on an instant nobody is pointing at any more.
    e.preventDefault();
    start = null;
    lock = null;
    onScrub(null);
    anchor(e);
  };

  const onMove = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      const t0 = e.touches[0]!;
      if (lock === 'scroll') return;
      // A pinch that lost a finger: what is left is one finger, so it is a cursor, and
      // its direction is decided from where it stands now rather than from where two
      // fingers began. Without this it would scrub for ever without ever locking, and so
      // could never hand a vertical drag back to the list.
      if (!start) start = {x: t0.clientX, y: t0.clientY};
      if (lock == null) {
        lock = lockAxis(t0.clientX - start.x, t0.clientY - start.y);
        // Handed to the scroller: the page is about to move under the chart, and a
        // playhead placed where the finger happened to pass is not something anyone
        // asked for.
        if (lock === 'scroll') {
          onScrub(null);
          return;
        }
      }
      // Once the finger is ours it stays ours, and the default goes — which also stops
      // the browser synthesising the mouse events that would otherwise arm uPlot's own
      // drag-select and crop to wherever the finger left off.
      if (lock === 'scrub') e.preventDefault();
      onScrub(scrubPos(t0));
      return;
    }
    e.preventDefault();
    // A finger arrived or left: everything below is measured against the anchor, so
    // re-anchor rather than reading this frame against a spread that no longer means
    // what it did.
    if (e.touches.length !== anchoredCount) {
      anchor(e);
      return;
    }
    storePos(to, e);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(applyRange);
    }
  };

  const onEnd = (e: TouchEvent) => {
    if (e.touches.length > 0) return;
    // The cursor goes when the last finger does — the same thing a mouse leaving the
    // plot does, and for the same reason: there is nothing under the pointer any more.
    // The playhead stays where it was put, which is the point of having placed it.
    if (lock !== 'scroll') onScrub(null);
    start = null;
    lock = null;
  };

  // Safari's own two-finger gesture, which it fires alongside the touch events and which
  // `touch-action` alone has not always been enough to talk it out of. Refused here, on
  // the plot area only, so a pinch on a chart crops the chart instead of zooming the page
  // — everywhere else on the page the browser's zoom is untouched. Not a standard event,
  // hence the bare string; other browsers simply never fire it.
  const blockPageZoom = (e: Event) => e.preventDefault();

  over.addEventListener('touchstart', onStart, {passive: false});
  over.addEventListener('touchmove', onMove, {passive: false});
  over.addEventListener('touchend', onEnd);
  over.addEventListener('touchcancel', onEnd);
  over.addEventListener('gesturestart', blockPageZoom);

  return () => {
    over.removeEventListener('touchstart', onStart);
    over.removeEventListener('touchmove', onMove);
    over.removeEventListener('touchend', onEnd);
    over.removeEventListener('touchcancel', onEnd);
    over.removeEventListener('gesturestart', blockPageZoom);
  };
}
