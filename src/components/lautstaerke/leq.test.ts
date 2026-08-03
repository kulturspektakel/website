import {describe, expect, it} from 'vitest';
import {coverageNote, energeticMeanDb, expectedMinutes} from './leq';

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
    expect(energeticMeanDb([null, Number.NaN, 60, Infinity])).toBeCloseTo(60, 10);
  });

  it('returns null when there is nothing to average', () => {
    expect(energeticMeanDb([])).toBeNull();
    expect(energeticMeanDb([null, null])).toBeNull();
  });
});

describe('expectedMinutes', () => {
  const start = new Date('2026-08-01T10:00:00Z');

  it('counts the whole span for a window already in the past', () => {
    const end = new Date('2026-08-01T11:00:00Z');
    expect(expectedMinutes(start, end, Date.parse('2026-08-01T20:00:00Z'))).toBe(60);
  });

  // The picker's default window ends at the current minute and every poll runs
  // against a window whose end is ahead of now — neither has "missing" minutes.
  it('counts only elapsed time for a window ending in the future', () => {
    const end = new Date('2026-08-01T12:00:00Z');
    expect(expectedMinutes(start, end, Date.parse('2026-08-01T10:30:00Z'))).toBe(30);
  });

  it('is zero for a window that has not started', () => {
    const end = new Date('2026-08-01T12:00:00Z');
    expect(expectedMinutes(start, end, Date.parse('2026-08-01T09:00:00Z'))).toBe(0);
  });
});

describe('coverageNote', () => {
  const totals = (minutes: number, expectedMinutes: number) => ({
    laeq: 60,
    lceq: 60,
    minutes,
    expectedMinutes,
  });

  it('flags a window the device was substantially offline for', () => {
    expect(coverageNote(totals(180, 360))).toBe('50 % Daten');
    expect(coverageNote(totals(40, 60))).toBe('67 % Daten');
    expect(coverageNote(totals(6, 10))).toBe('60 % Daten');
  });

  // A zoomed window's bounds don't land on minute boundaries, so expectedMinutes
  // is only good to ±1. Without the absolute floor these read as half-missing.
  it('does not flag a short zoom that is simply not a whole number of minutes', () => {
    expect(coverageNote(totals(1, 2))).toBeUndefined();
    expect(coverageNote(totals(2, 3))).toBeUndefined();
  });

  it('does not flag a stray dropped minute', () => {
    expect(coverageNote(totals(60, 60))).toBeUndefined();
    expect(coverageNote(totals(59, 60))).toBeUndefined();
    expect(coverageNote(totals(355, 360))).toBeUndefined();
  });

  it('says nothing about a window that has not started', () => {
    expect(coverageNote(totals(0, 0))).toBeUndefined();
  });
});
