import {describe, expect, it} from 'vitest';
import {
  commitProjectSelection,
  isCropped,
  panProjectSelection,
  resolveProjectSelection,
  selectionThumbs,
  setProjectBound,
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

describe('isCropped', () => {
  const window = {
    start: Date.parse('2026-07-24T00:00:00Z'),
    end: Date.parse('2026-07-27T00:00:00Z'),
  };

  // What decides whether a drag inside the lit part pans the window or places the
  // playhead: with the whole strip selected there is nothing to slide.
  it('is false for the whole window, whatever the cursor does', () => {
    for (const current of [
      window.start,
      window.end,
      window.start + MINUTE_MS,
    ]) {
      expect(isCropped({...window, current}, window)).toBe(false);
    }
  });

  it('is true as soon as either end moves inwards', () => {
    expect(
      isCropped(
        {...window, start: window.start + MINUTE_MS, current: 0},
        window,
      ),
    ).toBe(true);
    expect(
      isCropped({...window, end: window.end - MINUTE_MS, current: 0}, window),
    ).toBe(true);
  });
});

describe('panProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T00:00:00Z'),
    end: Date.parse('2026-07-27T00:00:00Z'),
  };
  const QUARTER_MS = 15 * MINUTE_MS;
  const at = (iso: string) => Date.parse(iso);
  const selection = {
    start: at('2026-07-25T18:00:00Z'),
    current: at('2026-07-25T19:00:00Z'),
    end: at('2026-07-25T20:00:00Z'),
  };
  const length = (s: {start: number; end: number}) => s.end - s.start;

  it('slides the window and leaves the cursor where it was', () => {
    const panned = panProjectSelection(selection, QUARTER_MS, window);
    expect(panned).toEqual({
      start: at('2026-07-25T18:15:00Z'),
      current: selection.current,
      end: at('2026-07-25T20:15:00Z'),
    });
  });

  it('snaps the shift, so the window keeps its exact length', () => {
    // A window typed as :07 to :20 travels as :07 to :20. Snapping the two ends
    // separately — which is what a thumb drag does — would stretch it.
    const odd = {
      start: at('2026-07-25T18:07:00Z'),
      current: at('2026-07-25T18:30:00Z'),
      end: at('2026-07-25T19:20:00Z'),
    };
    const panned = panProjectSelection(odd, 20 * MINUTE_MS, window);
    expect(length(panned)).toBe(length(odd));
    expect(panned.start).toBe(at('2026-07-25T18:22:00Z'));
    expect(panned.end).toBe(at('2026-07-25T19:35:00Z'));
  });

  it('rounds a shift shorter than a step to the nearest one', () => {
    expect(panProjectSelection(selection, 2 * MINUTE_MS, window)).toEqual(
      selection,
    );
    expect(panProjectSelection(selection, 8 * MINUTE_MS, window).start).toBe(
      selection.start + QUARTER_MS,
    );
  });

  it('pans backwards too', () => {
    const panned = panProjectSelection(selection, -QUARTER_MS, window);
    expect(panned.start).toBe(at('2026-07-25T17:45:00Z'));
    expect(length(panned)).toBe(length(selection));
  });

  it('stops against the edges instead of being squashed against them', () => {
    // A shift far past either end slides the window flush and keeps its length —
    // clamping the bounds rather than the shift would collapse it onto the edge.
    const toStart = panProjectSelection(
      selection,
      -999 * 60 * MINUTE_MS,
      window,
    );
    expect(toStart.start).toBe(window.start);
    expect(length(toStart)).toBe(length(selection));

    const toEnd = panProjectSelection(selection, 999 * 60 * MINUTE_MS, window);
    expect(toEnd.end).toBe(window.end);
    expect(length(toEnd)).toBe(length(selection));
  });

  it('holds the cursor still while the window still contains it', () => {
    // 19:00 stays 19:00 as the window slides around it: the instant the page is
    // showing levels for shouldn't move because its context did.
    for (const delta of [-QUARTER_MS, 0, QUARTER_MS, 30 * MINUTE_MS]) {
      expect(panProjectSelection(selection, delta, window).current).toBe(
        selection.current,
      );
    }
  });

  it('drags the cursor along only once an edge overtakes it', () => {
    // Panned right past 19:00, the start edge pushes the cursor ahead of it — and no
    // further, so it sits on the edge rather than keeping its old offset.
    const right = panProjectSelection(selection, 2 * 60 * MINUTE_MS, window);
    expect(right.current).toBe(right.start);
    expect(right.start).toBe(at('2026-07-25T20:00:00Z'));

    const left = panProjectSelection(selection, -2 * 60 * MINUTE_MS, window);
    expect(left.current).toBe(left.end);
    expect(left.end).toBe(at('2026-07-25T18:00:00Z'));
  });

  it('never leaves the cursor outside the window, however far it is panned', () => {
    for (const delta of [-9e9, -999 * MINUTE_MS, 0, 999 * MINUTE_MS, 9e9]) {
      const panned = panProjectSelection(selection, delta, window);
      expect(panned.current).toBeGreaterThanOrEqual(panned.start);
      expect(panned.current).toBeLessThanOrEqual(panned.end);
    }
  });

  it('does nothing to a selection that fills the window', () => {
    const full = {...window, current: at('2026-07-25T12:00:00Z')};
    expect(panProjectSelection(full, 99 * MINUTE_MS, window)).toEqual(full);
  });
});
