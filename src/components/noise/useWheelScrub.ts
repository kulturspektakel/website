import {useCallback, useEffect, useRef, type RefObject} from 'react';
import {useLatest} from './chartUtils';
import {usePlayheadEffect, useProjectView} from './projectView';
import {clampTo, snapToMinute} from './timeframe';
import {sidewaysWheelPx} from './uplotTouchGestures';

/**
 * A sideways swipe over `target` moves the page's playhead — the map's answer to the
 * charts' own sideways swipe, which slides their window instead: the map has no window,
 * and the one thing on it that moves in time is which instant the pins read.
 *
 * At the timeline's rate: a swipe the width of the strip carries the playhead across the
 * whole pickable project, the same distance a hand on the strip itself would take it. The
 * strip spans the page and the map is edge to edge beneath it, so the map's width stands
 * in for the strip's.
 *
 * Only the sideways part is taken (see sidewaysWheelPx). A vertical scroll is the map's
 * zoom, and a pinch arrives as a ctrl-wheel, so both pass straight through. Listened for in
 * the capture phase on the box around the map, which is what gets there before Google's
 * own handlers on the canvas inside it — and stopped there, so the map never sees a swipe
 * it would otherwise read as a pan.
 *
 * Nothing while live, where there is no playhead to move, nor while the map is being edited,
 * where it is held still (see ProjectViewCtx's `placing`) — and a swipe then is the map's
 * again.
 */
export function useWheelScrub(target: RefObject<HTMLElement | null>) {
  const {live, placing, bounds, range, scrubTo} = useProjectView();
  const boundsRef = useLatest(bounds);
  const rangeRef = useLatest(range);

  // Where the playhead stands, off its signal rather than off a render. And where the
  // swipe has taken it to the millisecond, since each commit lands on a minute: a slow
  // swipe moves less than a minute per frame, and without the exact figure carried
  // between frames it would round back to where it started every time.
  const playhead = useRef<number | null>(null);
  // The swipe's own last commit: where it had exactly got to, and where the playhead stood
  // when it was sent — the signal only catches up once the page has rendered, and a frame
  // that lands before then must not mistake the old position for somebody else's hover.
  const swiped = useRef<{exact: number; before: number | null} | null>(null);
  usePlayheadEffect(
    useCallback((at: number | null) => {
      playhead.current = at;
    }, []),
  );

  useEffect(() => {
    const el = target.current;
    if (live || placing || !el) return;

    let pendingPx = 0;
    let frame: number | null = null;

    const apply = () => {
      frame = null;
      const width = el.clientWidth;
      const px = pendingPx;
      pendingPx = 0;
      if (width <= 0) return;
      const {start, end} = boundsRef.current;
      // Picked up from wherever the playhead is — unless this swipe put it there, in which
      // case from where the swipe had really got to. A page nobody has pointed at yet
      // starts from the crop's beginning.
      const committed = playhead.current;
      const own = swiped.current;
      const from =
        own &&
        (committed === snapToMinute(own.exact) || committed === own.before)
          ? own.exact
          : (committed ?? rangeRef.current.start);
      // Later for a swipe to the left, as on the charts: the evening moves with the fingers
      // the way a scrolled page does.
      const next = clampTo(from + (px / width) * (end - start), start, end);
      swiped.current = {exact: next, before: committed};
      scrubTo(snapToMinute(next));
    };

    const onWheel = (e: WheelEvent) => {
      const px = sidewaysWheelPx(e);
      if (px == null) return;
      // The map would read it as a pan, and the browser as a back swipe.
      e.preventDefault();
      e.stopPropagation();
      pendingPx += px;
      frame ??= requestAnimationFrame(apply);
    };

    // Not passive: cancelling the event is the point.
    el.addEventListener('wheel', onWheel, {capture: true, passive: false});
    return () => {
      el.removeEventListener('wheel', onWheel, {capture: true});
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [live, placing, target, boundsRef, rangeRef, scrubTo]);
}
