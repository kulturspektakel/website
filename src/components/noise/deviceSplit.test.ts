import {describe, expect, it} from 'vitest';
import {parseSplit, splitFor} from './deviceSplit';

describe('parseSplit', () => {
  it('reads back what was stored', () => {
    expect(
      parseSplit(JSON.stringify({readings: 120, width: 1400, height: 800})),
    ).toEqual({readings: 120, width: 1400, height: 800});
  });

  // A stale or hand-edited entry costs the memory, never the page.
  it('is null for anything that is not a usable split', () => {
    expect(parseSplit(null)).toBeNull();
    expect(parseSplit('not json')).toBeNull();
    expect(parseSplit('3')).toBeNull();
    expect(parseSplit(JSON.stringify({readings: 120}))).toBeNull();
    expect(
      parseSplit(JSON.stringify({readings: '120', width: 1400, height: 800})),
    ).toBeNull();
    expect(
      parseSplit(JSON.stringify({readings: 0, width: 1400, height: 800})),
    ).toBeNull();
    // A readings row as tall as the whole box leaves no charts at all.
    expect(
      parseSplit(JSON.stringify({readings: 800, width: 1400, height: 800})),
    ).toBeNull();
  });
});

describe('splitFor', () => {
  const stored = {readings: 200, width: 1000, height: 800};

  it('is the stored height as a share of the box it is applied in', () => {
    expect(splitFor(stored, {width: 1000, height: 800})).toBe(25);
    // A box moved by a little keeps the pixels, so the share follows the box.
    expect(splitFor(stored, {width: 1050, height: 750})).toBeCloseTo(
      (200 / 750) * 100,
    );
  });

  // A different screen is not the arrangement anyone made.
  it('is null once the box has moved by more than a tenth either way', () => {
    expect(splitFor(stored, {width: 1000, height: 700})).toBeNull();
    expect(splitFor(stored, {width: 1000, height: 900})).toBeNull();
    expect(splitFor(stored, {width: 800, height: 800})).toBeNull();
    expect(splitFor(stored, {width: 1200, height: 800})).toBeNull();
  });
});
