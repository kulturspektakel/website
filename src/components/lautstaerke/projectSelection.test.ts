import {describe, expect, it} from 'vitest';
import {
  commitProjectSelection,
  parseProjectSelectionSearch,
  projectSelectionSearch,
  resolveProjectSelection,
  selectionThumbs,
  setProjectBound,
  thumbsToSelection,
  visibleProjectWindow,
} from './projectSelection';

describe('parseProjectSelectionSearch', () => {
  it('keeps parseable instants and drops the rest', () => {
    expect(
      parseProjectSelectionSearch({
        start: '2026-07-24T12:00:00.000Z',
        end: 'not-a-date',
        current: 42,
      }),
    ).toEqual({start: '2026-07-24T12:00:00.000Z'});
  });

  it('is empty for an untouched URL', () => {
    expect(parseProjectSelectionSearch({})).toEqual({});
  });
});

describe('resolveProjectSelection', () => {
  const window = {
    start: Date.parse('2026-07-24T12:00:00Z'),
    end: Date.parse('2026-07-27T16:00:00Z'),
  };

  it('defaults to the whole window with the cursor at its start', () => {
    expect(resolveProjectSelection({}, window)).toEqual({
      start: window.start,
      end: window.end,
      current: window.start,
    });
  });

  it('clamps values outside the project window', () => {
    expect(
      resolveProjectSelection(
        {start: '2020-01-01T00:00:00Z', end: '2030-01-01T00:00:00Z'},
        window,
      ),
    ).toEqual({start: window.start, end: window.end, current: window.start});
  });

  // A hand-edited URL with the ends swapped must collapse the range, not invert
  // it — an inverted range would make the slider's thumb order meaningless.
  it('collapses an inverted range instead of inverting it', () => {
    const {start, end} = resolveProjectSelection(
      {start: '2026-07-26T12:00:00Z', end: '2026-07-25T12:00:00Z'},
      window,
    );
    expect(end).toBe(start);
    expect(start).toBe(Date.parse('2026-07-26T12:00:00Z'));
  });

  it('pulls the cursor into the selected range', () => {
    const selection = resolveProjectSelection(
      {
        start: '2026-07-25T12:00:00Z',
        end: '2026-07-25T18:00:00Z',
        current: '2026-07-27T00:00:00Z',
      },
      window,
    );
    expect(selection.current).toBe(selection.end);
  });

  it('round-trips through the search params', () => {
    const selection = resolveProjectSelection(
      {
        start: '2026-07-25T12:00:00.000Z',
        end: '2026-07-25T18:00:00.000Z',
        current: '2026-07-25T14:37:00.000Z',
      },
      window,
    );
    expect(
      resolveProjectSelection(projectSelectionSearch(selection), window),
    ).toEqual(selection);
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
        commitProjectSelection({...previous, end: at(iso)}, previous, window).end,
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
      setProjectBound('end', Date.parse('2030-01-01T00:00:00Z'), selection, window)
        .end,
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
    expect(
      thumbsToSelection([selection.start, end], true, selection).end,
    ).toBe(end);
  });
});
