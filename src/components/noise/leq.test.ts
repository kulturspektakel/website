import {describe, expect, it} from 'vitest';
import {coverageDetail, energeticMeanDb} from './leq';
import {type HistoryRow} from './noise';

describe('energeticMeanDb', () => {
  // The load-bearing case: a plain mean would give 65. If this ever reads 65,
  // someone has "simplified" the energetic mean into an arithmetic one.
  it('averages energetically, not arithmetically', () => {
    expect(energeticMeanDb([60, 70])).toBeCloseTo(67.4, 1);
    expect(energeticMeanDb([60, 70])).not.toBeCloseTo(65, 1);
  });

  // Doubling the acoustic energy is +3 dB, so two equal levels average to
  // themselves rather than to something higher.
  it('leaves equal levels (and a single level) unchanged', () => {
    expect(energeticMeanDb([65, 65, 65])).toBeCloseTo(65, 10);
    expect(energeticMeanDb([82.5])).toBeCloseTo(82.5, 10);
  });

  // A loud minute dominates a quiet hour — that's the point of the energetic mean.
  it('is dominated by the loudest samples', () => {
    const quietWithOneSpike = [40, 40, 40, 40, 40, 40, 40, 40, 40, 100];
    expect(energeticMeanDb(quietWithOneSpike)).toBeCloseTo(90, 0);
  });

  it('skips gaps rather than treating them as silence', () => {
    expect(energeticMeanDb([70, null, 70])).toBeCloseTo(70, 10);
    expect(energeticMeanDb([null, Number.NaN, 60, Infinity])).toBeCloseTo(
      60,
      10,
    );
  });

  it('returns null when there is nothing to average', () => {
    expect(energeticMeanDb([])).toBeNull();
    expect(energeticMeanDb([null, null])).toBeNull();
  });
});
