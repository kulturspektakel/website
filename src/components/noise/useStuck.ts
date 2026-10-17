import {useEffect, useRef, useState} from 'react';

// Whether a sticky bar is standing over content right now — the page scrolled under a
// toolbar at the top, or more of it below a strip at the foot. Read off a zero-height
// sentinel placed where the bar would stand if it didn't stick (just before a top bar, just
// after a bottom one): once that point has left the view, the bar is stuck over something.
//
// Off an observer rather than a scroll listener, because what scrolls is the layout's box
// and not necessarily the window, and an observer sees clipping by either; and only on the
// change, so a scroll renders nothing.
export function useStuck() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) =>
      setStuck(entry != null && !entry.isIntersecting),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return {sentinel, stuck};
}

// The shadow a stuck bar casts over what passes beyond it, downward from a top bar and
// upward from a bottom one — so content reads as going under the bar rather than being cut
// off at its rule. Eased in, and none while nothing is there to cast it over.
export const stuckShadow = (stuck: boolean, edge: 'top' | 'bottom') => ({
  boxShadow: stuck
    ? `0 ${edge === 'top' ? 4 : -4}px 12px rgba(0, 0, 0, 0.4)`
    : 'none',
  transition: 'box-shadow 0.15s ease-out',
});
