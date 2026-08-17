import {describe, expect, it} from 'vitest';
import {
  commitProjectSelection,
  drawProjectSelection,
  resolveProjectSelection,
  selectionThumbs,
  nudgeSelectionThumb,
  cropProjectSelection,
  pressProjectBound,
  setProjectBound,
  setSelectionCurrent,
  thumbsToSelection,
  visibleProjectWindow,
} from './projectSelection';
import {MINUTE_MS} from './timeframe';

// The project page's crop and the cursor inside — or beside — it are component state,
// resolved against a window whose right edge moves with the clock. These pin the clamping and
// ordering rules, which the timeline strip itself relies on holding.

describe('visibleProjectWindow', () => {
  const project = {
    start: Date.parse('2026-07-24T00:00:00Z'),
    end: Date.parse('2026-07-27T00:00:00Z'),
  };

  it('is the whole project once it is over', () => {
    expect(
      visibleProjectWindow(project, Date.parse('2026-08-01T00:00:00Z')),
    ).toEqual(project);
  });

  // There are no measurements in the future, so a running project is only
  // pickable up to now.
  it('clips a running project at the current time', () => {
    const now = Date.parse('2026-07-25T12:00:00Z');
    expect(visibleProjectWindow(project, now)).toEqual({
      start: project.start,
      end: now,
    });
  });

  // The load-bearing case: the slider copes with a zero-width window, but an
  // inverted one it would not.
  it('collapses to a point rather than inverting before the project starts', () => {
    const window = visibleProjectWindow(
      project,
      Date.parse('2026-07-01T00:00:00Z'),
    );
    expect(window).toEqual({start: project.start, end: project.start});
    expect(window.end).toBeGreaterThanOrEqual(window.start);
  });
});

describe('resolveProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };

  it('defaults to the whole window with no cursor in it', () => {
    // Not either edge: the playhead is where a pointer is pointing, and nothing is
    // pointing at a page just arrived at.
    expect(resolveProjectSelection(null, window)).toEqual({
      start: window.start,
      end: window.end,
      current: null,
    });
  });

  // The reason the page stores a pick (which may be null) rather than a resolved
  // selection: an untouched timeline follows the window as a running project advances.
  it('follows a window whose end has moved while nothing was chosen', () => {
    const later = {start: window.start, end: window.end + 60 * MINUTE_MS};
    expect(resolveProjectSelection(null, later)).toEqual({
      start: later.start,
      end: later.end,
      current: null,
    });
  });

  it('clamps values outside the project window', () => {
    expect(
      resolveProjectSelection(
        {
          start: Date.parse('2020-01-01T00:00:00Z'),
          end: Date.parse('2030-01-01T00:00:00Z'),
          current: Date.parse('2030-01-01T00:00:00Z'),
        },
        window,
      ),
    ).toEqual({start: window.start, end: window.end, current: window.end});
  });

  // An override left over from a wider window must collapse the range, not invert
  // it — an inverted range would make the slider's thumb order meaningless.
  it('collapses an inverted range instead of inverting it', () => {
    const {start, end} = resolveProjectSelection(
      {
        start: Date.parse('2026-07-26T12:00:00Z'),
        end: Date.parse('2026-07-25T12:00:00Z'),
        current: Date.parse('2026-07-26T12:00:00Z'),
      },
      window,
    );
    expect(end).toBe(start);
    expect(start).toBe(Date.parse('2026-07-26T12:00:00Z'));
  });

  // Not into the range: a playhead marks where a hand is pointing, and the strip can be
  // pointed at outside the crop (see ProjectSelection). The window is the only bound.
  it('leaves a cursor outside the range where it is', () => {
    const outside = Date.parse('2026-07-27T00:00:00Z');
    const selection = resolveProjectSelection(
      {
        start: Date.parse('2026-07-25T12:00:00Z'),
        end: Date.parse('2026-07-25T18:00:00Z'),
        current: outside,
      },
      window,
    );
    expect(selection.current).toBe(outside);
  });

  // What the timeline commits is fed straight back in as the next override, so
  // resolving an already-resolved selection has to be a no-op.
  it('is idempotent, so committing what it produced changes nothing', () => {
    const selection = resolveProjectSelection(
      {
        start: Date.parse('2026-07-25T12:00:00Z'),
        end: Date.parse('2026-07-25T18:00:00Z'),
        current: Date.parse('2026-07-25T14:37:00Z'),
      },
      window,
    );
    expect(resolveProjectSelection(selection, window)).toEqual(selection);
  });
});

describe('commitProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };
  const at = (iso: string) => Date.parse(iso);
  const previous = {
    start: at('2026-07-25T18:07:00Z'),
    current: at('2026-07-25T19:00:00Z'),
    end: at('2026-07-25T22:00:00Z'),
  };

  it('snaps a moved end to the nearest quarter hour, in both directions', () => {
    const endAt = (iso: string) =>
      new Date(
        commitProjectSelection({...previous, end: at(iso)}, previous, window)
          .end,
      ).toISOString();
    // 22:52 is 7 min from 22:45 and 8 from 23:00, so it rounds down.
    expect(endAt('2026-07-25T22:52:00Z')).toBe('2026-07-25T22:45:00.000Z');
    expect(endAt('2026-07-25T22:53:00Z')).toBe('2026-07-25T23:00:00.000Z');
    expect(endAt('2026-07-25T22:08:00Z')).toBe('2026-07-25T22:15:00.000Z');
  });

  // The whole reason snapping is per-thumb: a bound typed in by hand as 18:07 must
  // survive a drag of the cursor.
  it('leaves an untouched unaligned bound alone', () => {
    const next = commitProjectSelection(
      {...previous, current: at('2026-07-25T20:30:00Z')},
      previous,
      window,
    );
    expect(next.start).toBe(previous.start);
  });

  // The cursor is nothing to do with this grid: it is not one of the slider's thumbs, so no
  // gesture that ends here can have moved it, and where it *is* set it lands on the minute.
  it('never touches the cursor, on or off the grid', () => {
    const unaligned = at('2026-07-25T19:07:00Z');
    expect(
      commitProjectSelection(
        {...previous, current: unaligned, end: at('2026-07-25T22:52:00Z')},
        previous,
        window,
      ).current,
    ).toBe(unaligned);
  });

  // The crop moved, the hand did not: an edge dragged past the instant being read leaves it
  // standing where it was, on the dim ground the drag has just made.
  it('leaves the cursor behind when a bound moves past it', () => {
    const next = commitProjectSelection(
      {...previous, start: at('2026-07-25T20:00:00Z')},
      previous,
      window,
    );
    expect(next.current).toBe(previous.current);
    expect(next.current!).toBeLessThan(next.start);
  });

  it('keeps a snapped bound inside the project window', () => {
    const next = commitProjectSelection(
      {start: window.start, current: window.start, end: window.end},
      previous,
      window,
    );
    expect(next.start).toBeGreaterThanOrEqual(window.start);
    expect(next.end).toBeLessThanOrEqual(window.end);
  });
});

describe('setProjectBound', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:00:00Z'),
    end: Date.parse('2026-07-25T22:00:00Z'),
  };

  // Typed times are exact: rounding what someone deliberately entered is worse
  // than an unaligned bound.
  it('does not snap a typed time', () => {
    const next = setProjectBound(
      'start',
      Date.parse('2026-07-25T18:07:00Z'),
      selection,
      window,
    );
    expect(new Date(next.start).toISOString()).toBe('2026-07-25T18:07:00.000Z');
  });

  it('clamps outside the project window', () => {
    expect(
      setProjectBound(
        'end',
        Date.parse('2030-01-01T00:00:00Z'),
        selection,
        window,
      ).end,
    ).toBe(window.end);
  });

  it('pushes the other end along rather than inverting', () => {
    const next = setProjectBound(
      'start',
      Date.parse('2026-07-26T09:00:00Z'),
      selection,
      window,
    );
    expect(next.end).toBe(next.start);
    // And the playhead stays put while both ends travel past it: it is not part of the crop.
    expect(next.current).toBe(selection.current);
  });
});

// What a row chart commits: one end from the in/out keys, both from a drag. The two
// are one gesture at different degrees of completeness, so they are one function.
describe('cropProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:00:00Z'),
    end: Date.parse('2026-07-25T22:00:00Z'),
  };
  const at = (iso: string) => Date.parse(iso);

  it('takes one end and leaves the other where it was', () => {
    const next = cropProjectSelection(
      {start: at('2026-07-25T18:47:00Z')},
      selection,
      window,
    );
    expect(next.start).toBe(at('2026-07-25T18:47:00Z'));
    expect(next.end).toBe(selection.end);
  });

  it('takes both ends of a drag, in either direction', () => {
    const swept = {
      start: at('2026-07-25T21:00:00Z'),
      end: at('2026-07-25T20:03:00Z'),
    };
    const next = cropProjectSelection(swept, selection, window);
    expect(next.start).toBe(swept.end);
    expect(next.end).toBe(swept.start);
  });

  // The instant the page is reading levels at survives any crop, inside it or not: cropping
  // from a chart says which stretch to draw and does not move the hand that is pointing.
  it('keeps the playhead wherever it was', () => {
    expect(
      cropProjectSelection(
        {start: at('2026-07-25T18:30:00Z')},
        selection,
        window,
      ).current,
    ).toBe(selection.current);
    expect(
      cropProjectSelection(
        {start: at('2026-07-25T20:00:00Z'), end: at('2026-07-25T21:00:00Z')},
        selection,
        window,
      ).current,
    ).toBe(selection.current);
  });

  it('is a no-op when neither end is given', () => {
    expect(cropProjectSelection({}, selection, window)).toBe(selection);
  });
});

// A click on the strip outside the crop: the nearer end stretches out to meet it, on the same
// grid a grip's release lands on.
describe('pressProjectBound', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };
  const at = (iso: string) => Date.parse(iso);
  const selection = {
    start: at('2026-07-25T18:00:00Z'),
    current: at('2026-07-25T19:00:00Z'),
    end: at('2026-07-25T22:00:00Z'),
  };

  it('takes the nearer end, whichever side the press fell on', () => {
    const before = pressProjectBound(
      at('2026-07-25T16:07:00Z'),
      selection,
      window,
    );
    expect(before.start).toBe(at('2026-07-25T16:00:00Z'));
    expect(before.end).toBe(selection.end);

    const after = pressProjectBound(
      at('2026-07-25T23:53:00Z'),
      selection,
      window,
    );
    expect(after.end).toBe(at('2026-07-26T00:00:00Z'));
    expect(after.start).toBe(selection.start);
  });

  // The grid is commitProjectSelection's, which is what the grips land on when they are let
  // go — and its "only what moved snaps" rule holds here too.
  it('snaps only the end it moved', () => {
    const typed = {...selection, start: at('2026-07-25T18:07:00Z')};
    const next = pressProjectBound(at('2026-07-25T23:53:00Z'), typed, window);
    expect(next.end).toBe(at('2026-07-26T00:00:00Z'));
    expect(next.start).toBe(typed.start);
  });

  // A press beyond the far end drags that end over the near one, which is what setProjectBound
  // does for a typed time — and the playhead stays where it was, being no part of the crop.
  it('pushes the opposite end along, and leaves the playhead', () => {
    const next = pressProjectBound(
      at('2026-07-24T13:00:00Z'),
      selection,
      window,
    );
    expect(next.start).toBe(at('2026-07-24T13:00:00Z'));
    expect(next.end).toBe(selection.end);
    expect(next.current).toBe(selection.current);
  });
});

// A whole window drawn in one drag across the timeline strip: the press names one end, the
// pointer the other. To the minute, not to the grid the grips step by — a freehand window
// keeps the ends the hand gave it — and never empty, since a crop of no width shows nothing
// anywhere on the page.
describe('drawProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:00:00Z'),
    end: Date.parse('2026-07-25T22:00:00Z'),
  };
  const at = (iso: string) => Date.parse(iso);
  const draw = (anchor: number, to: number) =>
    drawProjectSelection({anchor, at: to}, selection, window);

  // Both ends exactly where the drag put them: the quarter-hour grid the grips and the arrow
  // keys land on has no say over a window drawn freehand.
  it('keeps the minute the drag ended on, off the quarter-hour grid', () => {
    expect(
      draw(at('2026-07-26T20:07:00Z'), at('2026-07-26T21:53:00Z')),
    ).toEqual({
      start: at('2026-07-26T20:07:00Z'),
      end: at('2026-07-26T21:53:00Z'),
      current: null,
    });
  });

  // Seconds are as far as it goes: a minute is what the loggers report and what every readout
  // prints, so a bound between two of them is a distinction nothing on the page can show.
  it('resolves to the whole minute', () => {
    expect(
      draw(
        at('2026-07-26T20:07:20Z'),
        at('2026-07-26T21:52:40Z') + 1, // a millisecond too, for good measure
      ),
    ).toEqual({
      start: at('2026-07-26T20:07:00Z'),
      end: at('2026-07-26T21:53:00Z'),
      current: null,
    });
  });

  // The press is one end, not necessarily the start: dragging leftwards is answered rather
  // than ignored, as a sweep across a chart is.
  it('orders the two ends, whichever way the drag went', () => {
    const rightwards = draw(
      at('2026-07-26T20:00:00Z'),
      at('2026-07-26T22:00:00Z'),
    );
    expect(
      draw(at('2026-07-26T22:00:00Z'), at('2026-07-26T20:00:00Z')),
    ).toEqual(rightwards);
  });

  // The drag was a real one — the strip only asks once the pointer has travelled — but on a
  // narrow window it can still begin and end inside the same minute.
  it('floors a drag inside one minute at a minute, away from the press', () => {
    expect(
      draw(at('2026-07-26T20:00:10Z'), at('2026-07-26T20:00:25Z')),
    ).toEqual({
      start: at('2026-07-26T20:00:00Z'),
      end: at('2026-07-26T20:01:00Z'),
      current: null,
    });
    expect(
      draw(at('2026-07-26T20:00:25Z'), at('2026-07-26T20:00:10Z')),
    ).toEqual({
      start: at('2026-07-26T19:59:00Z'),
      end: at('2026-07-26T20:00:00Z'),
      current: null,
    });
  });

  // Where the minute away from the press would leave the window, it is taken the other way:
  // the far end of the strip has room in one direction only.
  it('floors inwards at the end of the window', () => {
    expect(draw(window.end, window.end + 1_000)).toEqual({
      start: window.end - MINUTE_MS,
      end: window.end,
      current: null,
    });
    expect(draw(window.start, window.start - 1_000)).toEqual({
      start: window.start,
      end: window.start + MINUTE_MS,
      current: null,
    });
  });

  it('clamps a drag that ran past the end of the window', () => {
    expect(
      draw(at('2026-07-27T15:00:00Z'), window.end + 6 * 60 * MINUTE_MS),
    ).toEqual({
      start: at('2026-07-27T15:00:00Z'),
      end: window.end,
      current: null,
    });
  });

  // The hand is pointing at the window's moving edge while it is drawn, which that edge's
  // own readout already says — so the cursor goes, rather than being dragged along by the
  // clamp. The next hover names a new one.
  it('drops the playhead', () => {
    expect(draw(selection.start, selection.end).current).toBeNull();
  });
});

// The slider's two thumbs are the crop's two ends, and the playhead is not among them —
// it is drawn on the strip instead (see ProjectTimeline). These pin the mapping in both
// directions, because getting it wrong silently writes one bound into another.
describe('selectionThumbs / thumbsToSelection', () => {
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:37:00Z'),
    end: Date.parse('2026-07-25T22:00:00Z'),
  };

  it('is the crop’s two ends, cursor or no cursor', () => {
    expect(selectionThumbs(selection)).toEqual([
      selection.start,
      selection.end,
    ]);
    expect(selectionThumbs({...selection, current: null})).toEqual([
      selection.start,
      selection.end,
    ]);
  });

  it('round-trips', () => {
    expect(thumbsToSelection(selectionThumbs(selection), selection)).toEqual(
      selection,
    );
  });

  // The playhead is where a hand is pointing, and dragging an edge is not that hand moving:
  // it survives the drag untouched, whether or not the crop still contains it.
  it('carries the cursor through a drag of either end', () => {
    const moved = thumbsToSelection(
      [Date.parse('2026-07-25T20:00:00Z'), Date.parse('2026-07-25T23:00:00Z')],
      selection,
    );
    expect(moved.current).toBe(selection.current);
    expect(moved.start).toBe(Date.parse('2026-07-25T20:00:00Z'));
    expect(moved.end).toBe(Date.parse('2026-07-25T23:00:00Z'));
  });

  // Nothing may invent a cursor: a page nobody is pointing at has none, and a grip dragged
  // on one still has none afterwards.
  it('leaves an absent cursor absent', () => {
    const idle = {...selection, current: null};
    const end = Date.parse('2026-07-25T23:00:00Z');
    expect(thumbsToSelection([idle.start, end], idle)).toEqual({
      start: idle.start,
      current: null,
      end,
    });
  });
});

// What hovering a row chart or the timeline strip commits. Unlike every gesture that picks a
// window it keeps the exact instant under the pointer, and it must not disturb the crop.
describe('setSelectionCurrent', () => {
  const window = {
    start: Date.parse('2026-07-25T12:00:00Z'),
    end: Date.parse('2026-07-25T23:00:00Z'),
  };
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:00:00Z'),
    end: Date.parse('2026-07-25T20:00:00Z'),
  };

  it('takes the instant as given, off the quarter hour, and leaves the crop alone', () => {
    const at = Date.parse('2026-07-25T18:37:23.400Z');
    expect(setSelectionCurrent(selection, at)).toEqual({
      ...selection,
      current: at,
    });
  });

  // The point of the playhead not being one of the slider's thumbs: the strip can be pointed
  // at end to end, and an instant on the dim ground either side of the crop is as real as one
  // inside it — the readings for it are in the browser either way.
  it('lets the playhead stand outside the crop', () => {
    const before = Date.parse('2026-07-25T14:30:00Z');
    expect(setSelectionCurrent(selection, before).current).toBe(before);
    const after = Date.parse('2026-07-25T22:30:00Z');
    expect(setSelectionCurrent(selection, after).current).toBe(after);
  });

  // The project's window is the one bound left on a playhead, and it is held where every pick
  // passes through rather than here — so an instant off the end of the event is clamped by the
  // time anything reads it.
  it('leaves the window’s bound to resolveProjectSelection', () => {
    const past = setSelectionCurrent(
      selection,
      Date.parse('2026-07-26T06:00:00Z'),
    );
    expect(resolveProjectSelection(past, window).current).toBe(window.end);
    const before = setSelectionCurrent(
      selection,
      Date.parse('2026-07-25T06:00:00Z'),
    );
    expect(resolveProjectSelection(before, window).current).toBe(window.start);
  });

  // What leaving a chart or the strip commits: the same call, with no instant. The crop
  // is untouched, so letting the playhead go doesn't unpick the window it stood in.
  it('takes the playhead away entirely when handed no instant', () => {
    expect(setSelectionCurrent(selection, null)).toEqual({
      ...selection,
      current: null,
    });
  });
});

// The keyboard's gesture. Arrow keys are the only way to move a thumb without a
// pointer, so the grid it walks and the neighbour it stops at are pinned here.
describe('nudgeSelectionThumb', () => {
  const window = {
    start: Date.parse('2026-07-25T12:00:00Z'),
    end: Date.parse('2026-07-25T23:00:00Z'),
  };
  const at = (iso: string) => Date.parse(iso);
  const iso = (ms: number) => new Date(ms).toISOString();
  const selection = {
    start: at('2026-07-25T18:07:00Z'),
    current: at('2026-07-25T19:00:00Z'),
    end: at('2026-07-25T20:00:00Z'),
  };

  it('pulls an unaligned bound onto the grid on the first press', () => {
    // 18:07 + 15 min is 18:22, which snaps to 18:15 — not 18:22.
    expect(
      iso(nudgeSelectionThumb(selection, {index: 0, steps: 1}, window).start),
    ).toBe('2026-07-25T18:15:00.000Z');
  });

  it('steps whole grid units once a thumb is on the grid', () => {
    const onGrid = {...selection, end: at('2026-07-25T20:00:00Z')};
    expect(
      iso(nudgeSelectionThumb(onGrid, {index: 1, steps: 4}, window).end),
    ).toBe('2026-07-25T21:00:00.000Z');
  });

  // The playhead is no part of this: it is not a thumb, and an edge stepped over the instant
  // being read simply leaves it behind rather than shoving it along.
  it('steps an edge straight past the playhead', () => {
    const next = nudgeSelectionThumb(selection, {index: 0, steps: 8}, window);
    expect(iso(next.start)).toBe('2026-07-25T20:00:00.000Z');
    expect(next.current).toBe(selection.current);
  });

  // The other end is where it stops, which is where zag's own stepping stops too.
  it('stops an edge at the other end of the crop', () => {
    const next = nudgeSelectionThumb(selection, {index: 0, steps: 20}, window);
    expect(next.start).toBe(selection.end);
    expect(next.end).toBe(selection.end);
  });
});
