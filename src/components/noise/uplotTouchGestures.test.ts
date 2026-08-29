import {afterEach, describe, expect, it, vi} from 'vitest';
import type uPlot from 'uplot';
import {
  LOCK_PX,
  MIN_RANGE_S,
  attachTouchGestures,
  lockAxis,
  pinchWindow,
} from './uplotTouchGestures';

// The two decisions a finger gesture makes, both of them arithmetic that is wrong in ways
// nobody notices until a pinch at the end of a festival throws the window off the strip:
// which axis a single finger meant, and what window two fingers are asking for.

describe('lockAxis', () => {
  it('waits until the finger has moved far enough to mean it', () => {
    expect(lockAxis(0, 0)).toBe(null);
    expect(lockAxis(LOCK_PX - 1, 0)).toBe(null);
    expect(lockAxis(0, -(LOCK_PX - 1))).toBe(null);
  });

  it('reads the dominant axis, in either direction', () => {
    expect(lockAxis(LOCK_PX, 2)).toBe('scrub');
    expect(lockAxis(-20, 5)).toBe('scrub');
    expect(lockAxis(2, LOCK_PX)).toBe('scroll');
    expect(lockAxis(-5, -20)).toBe('scroll');
  });

  // The list is the page's own gesture, so an ambiguous finger is let go rather than
  // captured: refusing to scroll is the more annoying of the two mistakes.
  it('gives a tie to the scroller', () => {
    expect(lockAxis(10, 10)).toBe('scroll');
    expect(lockAxis(-10, 10)).toBe('scroll');
  });
});

describe('pinchWindow', () => {
  const bounds: [number, number] = [0, 1000];
  // A 100-wide window in the middle of a 1000-wide project, the fingers' midpoint at the
  // centre of the plot — the state a gesture starts from below.
  const centred = {
    anchorSpan: 100,
    anchorVal: 500,
    midPct: 0.5,
    spreadRatio: 1,
    bounds,
  };

  it('leaves an untouched gesture where it found it', () => {
    expect(pinchWindow(centred)).toEqual({min: 450, max: 550});
  });

  // Two fingers that keep their spread are a pan: the value under them stays under them,
  // so the window travels and its width does not.
  it('slides without resizing when the spread is unchanged', () => {
    const {min, max} = pinchWindow({...centred, midPct: 0.9});
    expect(max - min).toBe(100);
    expect(min).toBe(410);
  });

  it('narrows as the fingers spread and widens as they close', () => {
    // A 400-wide window, so neither direction runs into the minute floor below.
    const wide = {...centred, anchorSpan: 400};
    // Fingers twice as far apart as they started: half the window.
    expect(pinchWindow({...wide, spreadRatio: 0.5})).toEqual({
      min: 400,
      max: 600,
    });
    expect(pinchWindow({...wide, spreadRatio: 2})).toEqual({
      min: 100,
      max: 900,
    });
  });

  it('holds the value under the fingers as it zooms', () => {
    const {min, max} = pinchWindow({
      ...centred,
      anchorVal: 480,
      midPct: 0.25,
      spreadRatio: 0.5,
    });
    // A quarter of the way across a 50-wide window, starting at 467.5.
    expect(min + 0.25 * (max - min)).toBeCloseTo(480);
  });

  it('stops zooming in at the minute', () => {
    const {min, max} = pinchWindow({...centred, spreadRatio: 0.01});
    expect(max - min).toBe(MIN_RANGE_S);
  });

  it('never opens wider than the project', () => {
    expect(pinchWindow({...centred, spreadRatio: 100})).toEqual({
      min: 0,
      max: 1000,
    });
  });

  // The width the fingers asked for survives the edge: a window pushed off the end slides
  // up against it rather than being squashed against it, which is what keeps a pinch at
  // the last hour of a festival from silently becoming a different pinch.
  it('slides a window back inside the project, keeping its width', () => {
    const left = pinchWindow({...centred, anchorVal: 10});
    expect(left).toEqual({min: 0, max: 100});
    const right = pinchWindow({...centred, anchorVal: 990});
    expect(right).toEqual({min: 900, max: 1000});
  });

  it('is measured against the project it is given, not the one it started in', () => {
    // The same gesture inside a festival-sized strip: nothing to clamp, and the window
    // simply sits where the fingers put it.
    expect(
      pinchWindow({...centred, anchorVal: 10, bounds: [-1000, 1000]}),
    ).toEqual({min: -40, max: 60});
  });
});

// And the routing: which of the two gestures a hand turned out to be making, which is the
// half that decides whether a list of cards can still be scrolled with a finger on a
// chart. No DOM — the helper wants an element it can listen on and measure, and a plot it
// can read a scale off, so it is given exactly those.

const RECT = {left: 20, top: 10, width: 200, height: 100};

function fakeOver() {
  const listeners = new Map<string, Set<(e: unknown) => void>>();
  return {
    style: {} as {touchAction?: string},
    getBoundingClientRect: () => RECT,
    addEventListener(type: string, fn: (e: unknown) => void) {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener(type: string, fn: (e: unknown) => void) {
      listeners.get(type)?.delete(fn);
    },
    fire(type: string, event: unknown) {
      for (const fn of listeners.get(type) ?? []) fn(event);
    },
    listenerCount() {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
  };
}

// A finger, and the event carrying however many of them are down.
const at = (x: number, y: number) => ({clientX: x, clientY: y});
const touches = (...ts: Array<{clientX: number; clientY: number}>) => {
  const preventDefault = vi.fn();
  return {touches: ts, preventDefault};
};

// The x-scale the gesture is anchored against: 1000 units across 200 px of plot.
const SCALE = {min: 0, max: 1000};

function harness() {
  const over = fakeOver();
  const plot = {
    over,
    scales: {x: SCALE},
    posToVal: (pos: number) =>
      SCALE.min + (pos / RECT.width) * (SCALE.max - SCALE.min),
  };
  const onRange = vi.fn();
  const onScrub = vi.fn();
  const remove = attachTouchGestures(plot as unknown as uPlot, {
    bounds: () => [0, 10_000],
    onRange,
    onScrub,
  });
  return {over, onRange, onScrub, remove};
}

// The helper coalesces two-finger frames onto an animation frame, which node has no
// notion of: collect them and run them when the test is ready to look.
const frames: FrameRequestCallback[] = [];
vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
  frames.push(fn);
  return frames.length;
});
const flushFrames = () => {
  const pending = frames.splice(0);
  for (const fn of pending) fn(0);
};

afterEach(() => {
  frames.length = 0;
});

describe('attachTouchGestures', () => {
  it('leaves vertical scrolling to the browser', () => {
    const {over} = harness();
    expect(over.style.touchAction).toBe('pan-y');
  });

  // A tap is how you ask what a trace read at a moment, and it answers on the lift rather
  // than on the touch: the mark it leaves behind now stays there, and a finger that has only
  // just landed may still be about to scroll the list. It must not swallow the touch either,
  // for that same reason.
  it('reads the trace where a tap lifted, in plot pixels', () => {
    const {over, onScrub} = harness();
    const start = touches(at(120, 60));
    over.fire('touchstart', start);
    expect(onScrub).not.toHaveBeenCalled();
    expect(start.preventDefault).not.toHaveBeenCalled();
    over.fire('touchend', touches());
    // The instant, and then the cursor put away: the first is what the page reads from here
    // on, the second only takes the tooltip off a plot no finger is on.
    expect(onScrub.mock.calls).toEqual([[{left: 100, top: 50}], [null]]);
  });

  it('clamps a finger over the edge into the plot', () => {
    const {over, onScrub} = harness();
    over.fire('touchstart', touches(at(-100, 500)));
    over.fire('touchend', touches());
    expect(onScrub).toHaveBeenCalledWith({left: 0, top: RECT.height});
  });

  it('takes a horizontal drag as a scrub, and takes the gesture with it', () => {
    const {over, onScrub, onRange} = harness();
    over.fire('touchstart', touches(at(100, 60)));
    const move = touches(at(100 + LOCK_PX + 4, 62));
    over.fire('touchmove', move);
    expect(move.preventDefault).toHaveBeenCalled();
    expect(onScrub).toHaveBeenLastCalledWith({left: 90, top: 52});
    // One finger never moves the window, however far it travels.
    flushFrames();
    expect(onRange).not.toHaveBeenCalled();
  });

  it('hands a vertical drag back to the list, having read nothing', () => {
    const {over, onScrub} = harness();
    over.fire('touchstart', touches(at(100, 60)));
    const move = touches(at(102, 60 + LOCK_PX + 4));
    over.fire('touchmove', move);
    expect(move.preventDefault).not.toHaveBeenCalled();
    // Never named an instant, so there is nothing to take back — which is the whole reason
    // nothing is named before the lock: whatever the page was reading, it still is.
    expect(onScrub).not.toHaveBeenCalled();
    // And stays handed over: a scroll that drifts sideways is still a scroll, right up to
    // the lift.
    over.fire('touchmove', touches(at(180, 90)));
    over.fire('touchend', touches());
    expect(onScrub).not.toHaveBeenCalled();
  });

  it('crops with two fingers, and puts the cursor away when the second lands', () => {
    const {over, onScrub, onRange} = harness();
    over.fire('touchstart', touches(at(100, 60)));
    onScrub.mockClear();
    const second = touches(at(70, 60), at(170, 60));
    over.fire('touchstart', second);
    expect(second.preventDefault).toHaveBeenCalled();
    expect(onScrub).toHaveBeenCalledWith(null);
    // Fingers to twice their spread about the same midpoint: half the window, centred
    // where they started (posToVal(100) = 500 of the 0–1000 on screen).
    over.fire('touchmove', touches(at(20, 60), at(220, 60)));
    flushFrames();
    expect(onRange).toHaveBeenCalledWith(250, 750);
  });

  it('coalesces a gesture to one window per frame', () => {
    const {over, onRange} = harness();
    over.fire('touchstart', touches(at(70, 60), at(170, 60)));
    over.fire('touchmove', touches(at(60, 60), at(180, 60)));
    over.fire('touchmove', touches(at(40, 60), at(200, 60)));
    over.fire('touchmove', touches(at(20, 60), at(220, 60)));
    flushFrames();
    expect(onRange).toHaveBeenCalledTimes(1);
    // The last frame wins: the fingers are where they are, not where they passed.
    expect(onRange).toHaveBeenCalledWith(250, 750);
  });

  // Lifting one finger out of a pinch leaves a cursor, which then has to be able to lock
  // like any other single finger — including handing itself to the list.
  it('turns the finger left over from a pinch back into a cursor', () => {
    const {over, onScrub} = harness();
    over.fire('touchstart', touches(at(70, 60), at(170, 60)));
    over.fire('touchend', touches(at(70, 60)));
    onScrub.mockClear();
    // Re-seated where it stands, and reading nothing until it has crossed the threshold any
    // single finger crosses.
    over.fire('touchmove', touches(at(70, 60)));
    expect(onScrub).not.toHaveBeenCalled();
    // Which is what re-seating the origin is for: without something to measure the lock
    // against it could never hand itself over, and would read for ever.
    over.fire('touchmove', touches(at(72, 60 + LOCK_PX + 4)));
    expect(onScrub).not.toHaveBeenCalled();
  });

  // Only the tooltip goes with the finger. The instant the drag reported last is the one the
  // page keeps reading, so nothing is named on the way out.
  it('leaves the scrubbed instant behind when the last finger goes', () => {
    const {over, onScrub} = harness();
    over.fire('touchstart', touches(at(100, 60)));
    over.fire('touchmove', touches(at(100 + LOCK_PX + 4, 62)));
    onScrub.mockClear();
    over.fire('touchend', touches());
    expect(onScrub.mock.calls).toEqual([[null]]);
  });

  // A gesture the system took away rather than one a hand finished: the browser's scroller
  // claiming a finger is exactly the case a parked mark must not come out of.
  it('commits nothing when a tap is cancelled', () => {
    const {over, onScrub} = harness();
    over.fire('touchstart', touches(at(120, 60)));
    over.fire('touchcancel', touches());
    expect(onScrub).not.toHaveBeenCalledWith({left: 100, top: 50});
  });

  it('takes every listener with it', () => {
    const {over, remove} = harness();
    expect(over.listenerCount()).toBeGreaterThan(0);
    remove();
    expect(over.listenerCount()).toBe(0);
  });
});
