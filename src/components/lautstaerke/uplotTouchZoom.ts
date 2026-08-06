import type uPlot from 'uplot';
import type {MutableRefObject} from 'react';

// uPlot's mouse drag-to-select zoom doesn't fire on touch, so give touch devices
// a one-finger pan / two-finger pinch on the x-axis instead (adapted from
// uPlot's zoom-touch demo, x-only).
//
// A plain function rather than a hook, called from inside the chart's own create
// effect and torn down alongside the plot, so the listener lifetime is exactly
// the plot's and the teardown order is unchanged.

// Never zoom in past a one-minute window.
const MIN_RANGE_S = 60;
// Pixels of drag below which a gesture isn't a zoom.
const MIN_FINGER_SPREAD = 1;

export function attachTouchZoom(
  plot: uPlot,
  {
    fullRange,
    zoom,
    setZoomed,
    onCommit,
  }: {
    // The chart's default extent, read fresh on every frame: it's what a zoom is
    // clamped to, and what "no zoom" means.
    fullRange: () => [number, number];
    // The active zoom window, shared with the mouse drag-select so both gestures
    // drive one piece of state and a zoom survives redraws.
    zoom: MutableRefObject<[number, number] | null>;
    setZoomed: (zoomed: boolean) => void;
    // Fired once the fingers are off, never per frame — a pinch runs every
    // frame and would otherwise navigate dozens of times.
    onCommit: (range: [number, number] | null) => void;
  },
): () => void {
  const over = plot.over;
  // Stops the browser claiming the gesture for scroll.
  over.style.touchAction = 'none';

  // Finger midpoint x (px, relative to the plot) and spread `d` between the two
  // fingers (1 for a single finger, so the ratio stays 1 → pure pan).
  const fr = {x: 0, d: 1};
  const to = {x: 0, d: 1};
  let rect = over.getBoundingClientRect();
  let oxRange = 0;
  let xVal = 0;

  const storePos = (t: {x: number; d: number}, e: TouchEvent) => {
    const t0 = e.touches[0];
    const t0x = t0.clientX - rect.left;
    if (e.touches.length === 1) {
      t.x = t0x;
      t.d = 1;
    } else {
      const t1x = e.touches[1].clientX - rect.left;
      t.x = (t0x + t1x) / 2;
      t.d = Math.max(Math.abs(t1x - t0x), MIN_FINGER_SPREAD);
    }
  };

  // Re-anchor the gesture to the current scale and finger positions. Called on
  // touchstart and whenever the finger count changes mid-gesture, so `fr.d` and
  // `to.d` are always measured with the same number of fingers — otherwise
  // lifting a finger collapses `to.d` to 1 and zooms way out.
  let anchoredCount = 0;
  const anchor = (e: TouchEvent) => {
    rect = over.getBoundingClientRect();
    storePos(fr, e);
    anchoredCount = e.touches.length;
    const {min, max} = plot.scales.x;
    oxRange = (max ?? 0) - (min ?? 0);
    xVal = plot.posToVal(fr.x, 'x');
  };

  // Whether the current gesture actually moved the window. A plain tap also ends
  // in touchend, and must not be read as "zoom out".
  let gestureZoomed = false;
  let rafPending = false;
  const applyZoom = () => {
    rafPending = false;
    gestureZoomed = true;
    const [fullMin, fullMax] = fullRange();
    const fullSpan = fullMax - fullMin;
    const leftPct = to.x / rect.width;
    let nxRange = oxRange * (fr.d / to.d);
    nxRange = Math.min(Math.max(nxRange, MIN_RANGE_S), fullSpan);
    let nxMin = xVal - leftPct * nxRange;
    let nxMax = nxMin + nxRange;
    // Keep the window inside the full extent, preserving its width.
    if (nxMin < fullMin) [nxMin, nxMax] = [fullMin, fullMin + nxRange];
    if (nxMax > fullMax) [nxMin, nxMax] = [fullMax - nxRange, fullMax];
    // At full extent there's no zoom to persist — clear it so the reset button
    // hides and the default range takes over.
    if (nxRange >= fullSpan) {
      zoom.current = null;
      setZoomed(false);
    } else {
      zoom.current = [nxMin, nxMax];
      setZoomed(true);
    }
    plot.setScale('x', {min: nxMin, max: nxMax});
  };

  const onMove = (e: TouchEvent) => {
    e.preventDefault();
    if (e.touches.length !== anchoredCount) {
      anchor(e);
      return;
    }
    storePos(to, e);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(applyZoom);
    }
  };

  // preventDefault stops the browser's compatibility mouse events, which would
  // otherwise trigger uPlot's own drag-select and zoom to an empty region when
  // the touch ends.
  const onStart = (e: TouchEvent) => {
    e.preventDefault();
    anchor(e);
  };

  const onEnd = (e: TouchEvent) => {
    if (e.touches.length > 0 || !gestureZoomed) return;
    gestureZoomed = false;
    onCommit(zoom.current);
  };

  over.addEventListener('touchstart', onStart, {passive: false});
  over.addEventListener('touchmove', onMove, {passive: false});
  over.addEventListener('touchend', onEnd);
  over.addEventListener('touchcancel', onEnd);

  return () => {
    over.removeEventListener('touchstart', onStart);
    over.removeEventListener('touchmove', onMove);
    over.removeEventListener('touchend', onEnd);
    over.removeEventListener('touchcancel', onEnd);
  };
}
