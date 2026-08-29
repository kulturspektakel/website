import {describe, expect, it} from 'vitest';
import {parseStoredPick} from './seriesSelection';

// What a stored menu means. Four rules with any weight: the series come back in table order
// whatever order they were written in (so the primary is the finest of them — see
// primarySeries), anything unusable is null so the page falls back to dB(A) rather than
// drawing whatever was in localStorage, a page with room for one number gets one, and the
// timeframe's Leq is remembered alongside them rather than starting on every visit.
describe('parseStoredPick', () => {
  it('reads back the stored series in table order, and the range row with them', () => {
    expect(
      parseStoredPick('{"series":["peak:C","eq_fast:A"],"range":false}'),
    ).toEqual({picked: ['eq_fast:A', 'peak:C'], rangeLeq: false});
  });

  // The row is on by default, so a value that does not mention it — an entry from before it
  // was remembered, including the bare array an earlier version of this file wrote — leaves
  // it where it has always started.
  it('defaults the range row to on when the entry does not say', () => {
    expect(parseStoredPick('{"series":["eq_5m:A"]}')).toEqual({
      picked: ['eq_5m:A'],
      rangeLeq: true,
    });
    expect(parseStoredPick('["eq_5m:A"]')).toEqual({
      picked: ['eq_5m:A'],
      rangeLeq: true,
    });
  });

  it('drops series it does not know, and is null when none are left', () => {
    expect(parseStoredPick('{"series":["eq_5m:A","eq_5m:B"]}')?.picked).toEqual(
      ['eq_5m:A'],
    );
    // A key from a version that spelled them differently, an empty pick the page has no
    // state for, an object saying nothing about series, a value that was never JSON, and
    // nothing stored at all.
    expect(parseStoredPick('{"series":["laeq_5m"]}')).toBeNull();
    expect(parseStoredPick('{"series":[]}')).toBeNull();
    expect(parseStoredPick('{"range":true}')).toBeNull();
    expect(parseStoredPick('eq_5m:A')).toBeNull();
    expect(parseStoredPick(null)).toBeNull();
  });

  // The map's case: truncated rather than refused, so a set written by the list next door
  // still names the line the pins are drawn in.
  it('takes the first only where one is all there is room for', () => {
    expect(
      parseStoredPick('{"series":["peak:C","eq_fast:A"]}', true)?.picked,
    ).toEqual(['eq_fast:A']);
  });
});
