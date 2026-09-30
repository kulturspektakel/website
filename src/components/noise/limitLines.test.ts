import {describe, expect, it} from 'vitest';
import {
  isLimitSeries,
  limitLine,
  limitSegments,
  strictestLimit,
  type LimitLine,
  type LimitSeries,
} from './limitLines';
import {type SeriesKey} from './series';

// Three things this has to get right that a chart cannot show you it got wrong: a limit half
// off the crop is drawn across the part that is on it, two limits meeting at an hour do not
// both claim that hour — the same [start, end) rule assignmentsAt is held to — and a limit
// written against a series nobody is looking at is not drawn at all.

const at = (iso: string) => Date.parse(iso);

const limit = (
  series: LimitSeries,
  decibels: number,
  start: string,
  end: string,
): LimitLine => ({series, decibels, start: at(start), end: at(end)});

// The crop, in the seconds a plot's x scale is in.
const CROP_START = at('2026-07-25T20:00:00Z') / 1000;
const CROP_END = at('2026-07-25T23:00:00Z') / 1000;

const PICKED: SeriesKey[] = ['eq_fast:A'];

// A limit may be written against a weighting's Leq over its own hours as well as a series.
describe('isLimitSeries', () => {
  it('takes the series and the range keys, and nothing else', () => {
    expect(isLimitSeries('eq_fast:A')).toBe(true);
    expect(isLimitSeries('range:A')).toBe(true);
    expect(isLimitSeries('range:C')).toBe(true);
    expect(isLimitSeries('range:B')).toBe(false);
    expect(isLimitSeries('range')).toBe(false);
  });

  it('lets a stored range limit through to the chart', () => {
    const project = {start: new Date(0), end: new Date(1000)};
    const row = {decibels: 85, start: null, end: null};
    expect(limitLine({...row, series: 'range:A'}, project)?.series).toBe(
      'range:A',
    );
    expect(limitLine({...row, series: 'range:B'}, project)).toBeNull();
  });
});

describe('limitSegments', () => {
  // Drawn where its line is, like any other: with `Leq,Range` on the chart and not without.
  it('draws a range limit only where its line is drawn', () => {
    const range = [
      limit('range:A', 85, '2026-07-25T21:00:00Z', '2026-07-25T22:00:00Z'),
    ];
    expect(limitSegments(range, PICKED, CROP_START, CROP_END)).toEqual([]);
    expect(
      limitSegments(range, [...PICKED, 'range:A'], CROP_START, CROP_END),
    ).toHaveLength(1);
  });

  it('cuts a limit that runs past the crop to the crop', () => {
    expect(
      limitSegments(
        [
          limit(
            'eq_fast:A',
            95,
            '2026-07-25T12:00:00Z',
            '2026-07-26T04:00:00Z',
          ),
        ],
        PICKED,
        CROP_START,
        CROP_END,
      ),
    ).toEqual([
      {series: 'eq_fast:A', decibels: 95, from: CROP_START, to: CROP_END},
    ]);
  });

  it('drops a limit that has ended before the crop begins', () => {
    expect(
      limitSegments(
        [
          limit(
            'eq_fast:A',
            95,
            '2026-07-25T12:00:00Z',
            '2026-07-25T20:00:00Z',
          ),
        ],
        PICKED,
        CROP_START,
        CROP_END,
      ),
    ).toEqual([]);
  });

  // The point of a limit naming a series: a peak limit over a chart of A-weighted minute
  // levels would invite a comparison it cannot support, and read as headroom that isn't
  // there.
  it('drops a limit whose series is not being shown', () => {
    expect(
      limitSegments(
        [limit('peak:C', 130, '2026-07-25T20:00:00Z', '2026-07-25T23:00:00Z')],
        PICKED,
        CROP_START,
        CROP_END,
      ),
    ).toEqual([]);
  });

  // The day/night pair the feature exists for: one line stops where the other starts, and
  // the shared instant belongs to the later of them alone.
  it('does not overlap two limits that meet at one instant', () => {
    const changeover = at('2026-07-25T22:00:00Z') / 1000;
    expect(
      limitSegments(
        [
          limit(
            'eq_fast:A',
            100,
            '2026-07-25T20:00:00Z',
            '2026-07-25T22:00:00Z',
          ),
          limit(
            'eq_fast:A',
            90,
            '2026-07-25T22:00:00Z',
            '2026-07-25T23:00:00Z',
          ),
        ],
        PICKED,
        CROP_START,
        CROP_END,
      ),
    ).toEqual([
      {series: 'eq_fast:A', decibels: 100, from: CROP_START, to: changeover},
      {series: 'eq_fast:A', decibels: 90, from: changeover, to: CROP_END},
    ]);
  });
});

// What a map pin is judged against, which is the same window question asked for one figure
// instead of a set of lines — plus the tie-break a chart never has to make.
describe('strictestLimit', () => {
  const RANGE_START = at('2026-07-25T20:00:00Z');
  const RANGE_END = at('2026-07-25T23:00:00Z');

  it('takes the lowest of two limits in force over the range', () => {
    expect(
      strictestLimit(
        [
          limit(
            'eq_fast:A',
            100,
            '2026-07-25T20:00:00Z',
            '2026-07-25T22:00:00Z',
          ),
          limit(
            'eq_fast:A',
            90,
            '2026-07-25T22:00:00Z',
            '2026-07-26T00:00:00Z',
          ),
        ],
        'eq_fast:A',
        RANGE_START,
        RANGE_END,
      ),
    ).toBe(90);
  });

  // A permit written for another quantity is not a bound on this one, and a permit written
  // for other hours is not a bound on these.
  it('ignores another series and a limit outside the range', () => {
    const limits = [
      limit('peak:C', 130, '2026-07-25T20:00:00Z', '2026-07-25T23:00:00Z'),
      limit('eq_fast:A', 85, '2026-07-25T18:00:00Z', '2026-07-25T20:00:00Z'),
    ];
    expect(strictestLimit(limits, 'eq_fast:A', RANGE_START, RANGE_END)).toBe(
      null,
    );
  });
});
