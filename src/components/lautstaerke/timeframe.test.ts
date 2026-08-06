import {describe, expect, it} from 'vitest';
import {
  dayRangeSearch,
  defaultRange,
  floorToMinute,
  fromLocalInput,
  parseRangeSearch,
  rangeSearch,
  snapToQuarter,
  toLocalInput,
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

// What the project timeline's thumbs snap to on release; the clamping and
// ordering built on top of it live in projectSelection.test.ts.
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

describe('floorToMinute', () => {
  // Both sides of the level query floor to this — the client to key the request,
  // the server to find the aggregate — so the two must agree exactly. A minute
  // is a UTC minute here, deliberately: every zone Berlin uses is a whole-hour
  // offset, so a local minute and a UTC minute are the same instant.
  it('floors to the start of the containing minute', () => {
    const at = (iso: string) => new Date(floorToMinute(Date.parse(iso))).toISOString();
    expect(at('2026-07-24T18:07:59.999Z')).toBe('2026-07-24T18:07:00.000Z');
    expect(at('2026-07-24T18:07:00.000Z')).toBe('2026-07-24T18:07:00.000Z');
  });

  it('is idempotent', () => {
    const once = floorToMinute(Date.parse('2026-07-24T18:07:42Z'));
    expect(floorToMinute(once)).toBe(once);
  });
});

describe('defaultRange', () => {
  it('offers the hour ending at the current minute', () => {
    const {start, end} = defaultRange(Date.parse('2026-07-24T18:07:42Z'));
    expect(end.toISOString()).toBe('2026-07-24T18:07:00.000Z');
    expect(start.toISOString()).toBe('2026-07-24T17:07:00.000Z');
  });

  // Whatever it offers has to be a range the picker and the query will accept.
  it('produces a range parseRangeSearch accepts', () => {
    const range = defaultRange(Date.parse('2026-07-24T18:07:42Z'));
    expect(parseRangeSearch(rangeSearch(range))).toEqual(range);
  });
});

describe('rangeSearch / parseRangeSearch', () => {
  // The older and more used of the two round trips, and the only one that was
  // untested: the URL is the single source of truth for the viewed timeframe.
  it('round-trips a range through the URL', () => {
    const range = {
      start: new Date('2026-07-24T16:00:00Z'),
      end: new Date('2026-07-24T18:30:00Z'),
    };
    const search = rangeSearch(range);
    expect(search).toEqual({
      start: '2026-07-24T16:00:00.000Z',
      end: '2026-07-24T18:30:00.000Z',
    });
    expect(parseRangeSearch(search)).toEqual(range);
  });
});
