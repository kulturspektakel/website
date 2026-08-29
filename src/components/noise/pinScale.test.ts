import {describe, expect, it} from 'vitest';
import {LEVEL_BANDS, bandFill, levelBand} from './pinScale';

// The one thing a lookup table can get wrong that nobody sees on a map: which side of a
// round number a level falls on — and the round numbers are exactly where the limits are
// written and where the legend puts its labels.

describe('levelBand', () => {
  it('opens a band at its floor', () => {
    expect(levelBand(89.9)).toBe(levelBand(80));
    expect(levelBand(90)).toBe(levelBand(99.9));
    expect(levelBand(90)).toBe(levelBand(80) + 1);
  });

  it('holds a level off either end of the scale in the end bands', () => {
    expect(levelBand(12)).toBe(0);
    expect(levelBand(140)).toBe(LEVEL_BANDS.length - 1);
    expect(bandFill(140)).toBe(LEVEL_BANDS[LEVEL_BANDS.length - 1]!.fill);
  });
});
