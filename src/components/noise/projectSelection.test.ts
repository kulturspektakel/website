import {describe, expect, it} from 'vitest';
import {
  commitProjectSelection,
  resolveProjectSelection,
  selectionThumbs,
  nudgeSelectionThumb,
  cropProjectSelection,
  setProjectBound,
  setSelectionCurrent,
  thumbsToSelection,
  visibleProjectWindow,
} from './projectSelection';
import {MINUTE_MS} from './timeframe';

// The project page's three-thumb timeline is component state, resolved against a
// window whose right edge moves with the clock. These pin the clamping and ordering
// rules, which the slider itself relies on holding.

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

  it('defaults to the whole window with the cursor at its right edge', () => {
    // Not the left edge: for a running festival the right one is now, so the first
    // switch out of live mode freezes the moment you were watching.
    expect(resolveProjectSelection(null, window)).toEqual({
      start: window.start,
      end: window.end,
      current: window.end,
    });
  });

  // The reason the page stores a pick (which may be null) rather than a resolved
  // selection: an untouched timeline follows the window as a running project advances.
  it('follows a window whose end has moved while nothing was chosen', () => {
    const later = {start: window.start, end: window.end + 60 * MINUTE_MS};
    expect(resolveProjectSelection(null, later)).toEqual({
      start: later.start,
      end: later.end,
      current: later.end,
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

  it('pulls the cursor into the selected range', () => {
    const selection = resolveProjectSelection(
      {
        start: Date.parse('2026-07-25T12:00:00Z'),
        end: Date.parse('2026-07-25T18:00:00Z'),
        current: Date.parse('2026-07-27T00:00:00Z'),
      },
      window,
    );
    expect(selection.current).toBe(selection.end);
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

  it('snaps a moved cursor too, since the slider steps in quarters', () => {
    const next = commitProjectSelection(
      {...previous, current: at('2026-07-25T19:07:00Z')},
      previous,
      window,
    );
    expect(new Date(next.current).toISOString()).toBe(
      '2026-07-25T19:00:00.000Z',
    );
  });

  // An untouched cursor is left exactly where it was, so dragging a bound can't
  // quietly move the instant you were looking at.
  it('leaves an untouched cursor alone', () => {
    const unaligned = {...previous, current: at('2026-07-25T19:07:00Z')};
    const next = commitProjectSelection(
      {...unaligned, end: at('2026-07-25T23:00:00Z')},
      unaligned,
      window,
    );
    expect(next.current).toBe(unaligned.current);
  });

  it('pulls the cursor along when a bound moves past it', () => {
    const next = commitProjectSelection(
      {...previous, start: at('2026-07-25T20:00:00Z')},
      previous,
      window,
    );
    expect(next.current).toBe(next.start);
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
    expect(next.current).toBe(next.start);
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

  // The instant the page is reading levels at survives a crop it still falls inside,
  // and is pulled to the nearest edge of one it doesn't.
  it('keeps the playhead where the crop still contains it', () => {
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
    ).toBe(at('2026-07-25T20:00:00Z'));
  });

  it('is a no-op when neither end is given', () => {
    expect(cropProjectSelection({}, selection, window)).toBe(selection);
  });
});

// Live mode drops the cursor thumb, so the slider's indices shift. These pin the
// mapping in both directions, because getting it wrong silently writes one bound
// into another.
describe('selectionThumbs / thumbsToSelection', () => {
  const selection = {
    start: Date.parse('2026-07-25T18:00:00Z'),
    current: Date.parse('2026-07-25T19:37:00Z'),
    end: Date.parse('2026-07-25T22:00:00Z'),
  };

  it('has three thumbs when a cursor is shown, two when live', () => {
    expect(selectionThumbs(selection, false)).toEqual([
      selection.start,
      selection.current,
      selection.end,
    ]);
    expect(selectionThumbs(selection, true)).toEqual([
      selection.start,
      selection.end,
    ]);
  });

  it('round-trips in both modes', () => {
    for (const live of [false, true]) {
      expect(
        thumbsToSelection(selectionThumbs(selection, live), live, selection),
      ).toEqual(selection);
    }
  });

  // Turning live off should return you to the instant you were last looking at,
  // so dragging the range while live must not overwrite the cursor.
  it('carries the cursor through a live-mode drag', () => {
    const moved = thumbsToSelection(
      [Date.parse('2026-07-25T17:00:00Z'), Date.parse('2026-07-25T23:00:00Z')],
      true,
      selection,
    );
    expect(moved.current).toBe(selection.current);
    expect(moved.start).toBe(Date.parse('2026-07-25T17:00:00Z'));
    expect(moved.end).toBe(Date.parse('2026-07-25T23:00:00Z'));
  });

  // The end thumb is index 1 while live and index 2 otherwise — read it at the
  // wrong index and the range silently collapses onto the cursor.
  it('reads the end from the right index in live mode', () => {
    const end = Date.parse('2026-07-25T23:00:00Z');
    expect(thumbsToSelection([selection.start, end], true, selection).end).toBe(
      end,
    );
  });
});

// What hovering a row chart commits. Unlike every gesture on the timeline itself it
// keeps the exact instant under the pointer, and it must not disturb the crop.
describe('setSelectionCurrent', () => {
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

  it('clamps to the crop rather than widening it', () => {
    expect(
      setSelectionCurrent(selection, Date.parse('2026-07-25T06:00:00Z')),
    ).toEqual({...selection, current: selection.start});
    expect(
      setSelectionCurrent(selection, Date.parse('2026-07-25T23:00:00Z')),
    ).toEqual({...selection, current: selection.end});
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
      iso(
        nudgeSelectionThumb(
          selection,
          {index: 0, steps: 1, live: false},
          window,
        ).start,
      ),
    ).toBe('2026-07-25T18:15:00.000Z');
  });

  it('steps whole grid units once a thumb is on the grid', () => {
    const onGrid = {...selection, end: at('2026-07-25T20:00:00Z')};
    expect(
      iso(
        nudgeSelectionThumb(onGrid, {index: 2, steps: 4, live: false}, window)
          .end,
      ),
    ).toBe('2026-07-25T21:00:00.000Z');
  });

  // An edge must not shove the instant you are looking at out of the way; only a
  // pointer drag may do that.
  it('stops an edge at the playhead instead of pushing it', () => {
    const next = nudgeSelectionThumb(
      selection,
      {index: 0, steps: 8, live: false},
      window,
    );
    expect(next.start).toBe(selection.current);
    expect(next.current).toBe(selection.current);
  });
});
