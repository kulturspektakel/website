import {describe, expect, it} from 'vitest';
import {
  coverageDetail,
  coverageNote,
  energeticMeanDb,
  expectedMinutes,
  historyTotals,
} from './leq';
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

describe('expectedMinutes', () => {
  const start = new Date('2026-08-01T10:00:00Z');

  it('counts the whole span for a window already in the past', () => {
    const end = new Date('2026-08-01T11:00:00Z');
    expect(
      expectedMinutes(start, end, Date.parse('2026-08-01T20:00:00Z')),
    ).toBe(60);
  });

  // The picker's default window ends at the current minute and every poll runs
  // against a window whose end is ahead of now — neither has "missing" minutes.
  it('counts only elapsed time for a window ending in the future', () => {
    const end = new Date('2026-08-01T12:00:00Z');
    expect(
      expectedMinutes(start, end, Date.parse('2026-08-01T10:30:00Z')),
    ).toBe(30);
  });

  it('is zero for a window that has not started', () => {
    const end = new Date('2026-08-01T12:00:00Z');
    expect(
      expectedMinutes(start, end, Date.parse('2026-08-01T09:00:00Z')),
    ).toBe(0);
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

  // What the list row's warning sign says when hovered, where the note itself is
  // only the sign. Same percentage as the note, so the two can't disagree.
  it('spells the shortfall out for a tooltip', () => {
    expect(coverageDetail(totals(180, 360))).toBe(
      'Nur 180 von 360 Minuten im Zeitraum gemessen (50 %)',
    );
  });

  // Both wordings ask one predicate, so a caller can pick either without consulting
  // the other about whether there is anything to say.
  it('stays silent wherever the note does', () => {
    for (const t of [totals(59, 60), totals(1, 2), totals(0, 0)]) {
      expect(coverageDetail(t)).toBeUndefined();
      expect(coverageNote(t)).toBeUndefined();
    }
  });
});

describe('historyTotals', () => {
  const START = new Date('2026-07-24T18:00:00Z');
  const END = new Date('2026-07-24T19:00:00Z');
  // Well after END, so coverage is judged against the full hour.
  const AFTER = Date.parse('2026-07-24T20:00:00Z');

  const row = (laeq: number, lceq: number): HistoryRow => ({
    minute_epoch: 0,
    laeq_1m: laeq,
    laeq_5m: null,
    laeq_30m: null,
    lafmax: laeq,
    lceq_1m: lceq,
    lceq_5m: null,
    lceq_30m: null,
    lcfmax: lceq,
    lcpeak: lceq,
  });

  it('averages each weighting energetically and counts the minutes', () => {
    const totals = historyTotals([row(60, 70), row(70, 80)], START, END, AFTER);
    expect(totals.laeq).toBeCloseTo(67.4, 1);
    expect(totals.lceq).toBeCloseTo(77.4, 1);
    expect(totals.minutes).toBe(2);
    expect(totals.expectedMinutes).toBe(60);
  });

  // An empty window is a dash, not a zero — see energeticMeanDb.
  it('reports null levels for a window with no rows', () => {
    const totals = historyTotals([], START, END, AFTER);
    expect(totals.laeq).toBeNull();
    expect(totals.lceq).toBeNull();
    expect(totals.minutes).toBe(0);
  });

  // The pairing that makes the coverage note meaningful: 2 of 60 minutes is a
  // 3 %-covered hour, and the tile has to say so rather than imply it was quiet.
  it('feeds coverageNote a shortfall it will disclose', () => {
    const totals = historyTotals([row(60, 70), row(70, 80)], START, END, AFTER);
    expect(coverageNote(totals)).toBe('3 % Daten');
  });

  it('measures coverage against elapsed time for a window reaching into the future', () => {
    // Half an hour in: the minutes that haven't happened yet aren't missing.
    const halfway = Date.parse('2026-07-24T18:30:00Z');
    const rows = Array.from({length: 30}, () => row(65, 75));
    const totals = historyTotals(rows, START, END, halfway);
    expect(totals.expectedMinutes).toBe(30);
    expect(coverageNote(totals)).toBeUndefined();
  });
});
