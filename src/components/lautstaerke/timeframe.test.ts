import {describe, expect, it} from 'vitest';
import {
  dayRangeSearch,
  fromLocalInput,
  parseRangeSearch,
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
