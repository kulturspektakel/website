import {describe, expect, it} from 'vitest';
import {
  commitProjectSelection,
  dayRangeSearch,
  fromLocalInput,
  parseProjectSelectionSearch,
  parseRangeSearch,
  projectSelectionSearch,
  resolveProjectSelection,
  selectionThumbs,
  setProjectBound,
  thumbsToSelection,
  snapToQuarter,
  toLocalInput,
  visibleProjectWindow,
} from './timeframe';

// The URL carries UTC instants but a "day" is a Europe/Berlin day, so the two
// boundaries of one day can sit at different UTC offsets. These pin that math.
describe('dayRangeSearch', () => {
  it('offsets a summer day by CEST (UTC+2)', () => {
    expect(dayRangeSearch('2026-08-01')).toEqual({
      start: '2026-07-31T22:00:00.000Z',
      end: '2026-08-01T22:00:00.000Z',
    });
  });

  it('offsets a winter day by CET (UTC+1)', () => {
    expect(dayRangeSearch('2026-01-15')).toEqual({
      start: '2026-01-14T23:00:00.000Z',
      end: '2026-01-15T23:00:00.000Z',
    });
  });

  // Spring-forward: the local day is only 23 h long, and its two boundaries are
  // an hour apart in offset (CET going in, CEST coming out).
  it('handles the spring DST transition as a 23-hour day', () => {
    const {start, end} = dayRangeSearch('2026-03-29');
    expect({start, end}).toEqual({
      start: '2026-03-28T23:00:00.000Z',
      end: '2026-03-29T22:00:00.000Z',
    });
    expect(Date.parse(end) - Date.parse(start)).toBe(23 * 60 * 60 * 1000);
  });
});

// The picker's datetime-local fields are wall-clock in `timeZone`, so these two
// must round-trip regardless of the machine's own timezone.
describe('toLocalInput / fromLocalInput', () => {
  it('reads a wall-clock as Europe/Berlin in summer and winter', () => {
    expect(fromLocalInput('2026-08-01T18:30')?.toISOString()).toBe(
      '2026-08-01T16:30:00.000Z',
    );
    expect(fromLocalInput('2026-01-15T18:30')?.toISOString()).toBe(
      '2026-01-15T17:30:00.000Z',
    );
  });

  it('round-trips across the spring-forward gap', () => {
    // 02:30 local does not exist on 2026-03-29; whatever instant we resolve to
    // must render back to a wall-clock that resolves to the same instant.
    const instant = fromLocalInput('2026-03-29T02:30');
    expect(instant).not.toBeNull();
    const back = fromLocalInput(toLocalInput(instant!.getTime()));
    expect(back?.getTime()).toBe(instant!.getTime());
  });

  it('rejects an empty or partial field', () => {
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('2026-08-01')).toBeNull();
  });
});

describe('parseRangeSearch', () => {
  it('rejects malformed, empty, and inverted ranges', () => {
    expect(parseRangeSearch({})).toBeNull();
    expect(parseRangeSearch({start: 'nope', end: '2026-08-01T00:00:00Z'})).toBeNull();
    const same = '2026-08-01T00:00:00Z';
    expect(parseRangeSearch({start: same, end: same})).toBeNull();
    expect(
      parseRangeSearch({start: '2026-08-02T00:00:00Z', end: same}),
    ).toBeNull();
  });

  // The cap lives here so validateSearch, the server fn, and the picker all
  // inherit it — an over-wide hand-edited URL degrades to the live view.
  it('rejects a range wider than the cap', () => {
    const start = '2026-08-01T00:00:00Z';
    expect(
      parseRangeSearch({start, end: '2026-08-08T00:00:01Z'}),
    ).toBeNull();
    expect(parseRangeSearch({start, end: '2026-08-08T00:00:00Z'})).not.toBeNull();
  });

  it('normalizes a non-UTC offset to the same instant', () => {
    const range = parseRangeSearch({
      start: '2026-08-01T00:00:00+02:00',
      end: '2026-08-01T12:00:00+02:00',
    });
    expect(range?.start.toISOString()).toBe('2026-07-31T22:00:00.000Z');
    expect(range?.end.toISOString()).toBe('2026-08-01T10:00:00.000Z');
  });
});

// The project page's three-thumb timeline lives in the URL, and the selection has
// to survive a hand-edited or stale one. These pin the clamping and ordering
// rules, which the slider itself relies on holding.
describe('snapToQuarter', () => {
  it('rounds to the nearest wall-clock quarter hour', () => {
    const at = (iso: string) => new Date(snapToQuarter(Date.parse(iso))).toISOString();
    expect(at('2026-07-24T18:07:00.000Z')).toBe('2026-07-24T18:00:00.000Z');
    expect(at('2026-07-24T18:08:00.000Z')).toBe('2026-07-24T18:15:00.000Z');
    expect(at('2026-07-24T18:52:30.000Z')).toBe('2026-07-24T19:00:00.000Z');
  });

  // Berlin is a whole-hour offset from UTC, so snapping in absolute time also
  // lands on a local :00/:15/:30/:45 — that's what makes the simple math valid.
  it('lands on a local quarter hour too', () => {
    const local = toLocalInput(snapToQuarter(Date.parse('2026-07-24T18:08:00Z')));
    expect(local.endsWith(':15')).toBe(true);
  });
});

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
