import {describe, expect, it} from 'vitest';
import type {NoiseRecording} from '../../proto/noise';
import {
  decidingLimit,
  judgeLimit,
  limitGlow,
  limitStateOf,
  type SeriesLimit,
} from './limitState';
import {type SeriesKey} from './series';

// Levels come off the wire encoded as (dB - 20) * 2, so 87.5 dB is byte 135.
const encoded = (db: number) => (db - 20) * 2;

const LAEQ = 'eq_fast:A' as SeriesKey;
const LAEQ_30M = 'eq_30m:A' as SeriesKey;
const LCPEAK = 'peak:C' as SeriesKey;

const limit = (series: SeriesKey, decibels: number): SeriesLimit => ({
  series,
  decibels,
  start: 0,
  end: 1,
});

// A record with the LAeq,1s and, where given, the LAeq,30m.
const record = (laeq: number, laeq30m?: number) =>
  ({
    laeq: encoded(laeq),
    laeq30m: laeq30m == null ? undefined : encoded(laeq30m),
  }) as NoiseRecording;

describe('judgeLimit', () => {
  it('is red when the window is over and the level now is too', () => {
    expect(judgeLimit(limit(LAEQ_30M, 65), record(70, 66)).state).toBe('over');
  });

  // Over, but the level feeding it is under: held there, the window comes back down.
  it('is recovering when the window is over but the level now is under', () => {
    expect(judgeLimit(limit(LAEQ_30M, 65), record(60, 66)).state).toBe(
      'recovering',
    );
    // On the limit is within it, so heading back under.
    expect(judgeLimit(limit(LAEQ_30M, 65), record(65, 66)).state).toBe(
      'recovering',
    );
  });

  // The window is under, but the level feeding it is over: held there, the window follows.
  it('is amber when the window is under but the level now is over', () => {
    const judged = judgeLimit(limit(LAEQ_30M, 65), record(68, 63));
    expect(judged.state).toBe('near');
    expect(judged.current).toBe(68);
  });

  it('is green when neither is over', () => {
    expect(judgeLimit(limit(LAEQ_30M, 65), record(64, 63)).state).toBe('ok');
  });

  // Sitting exactly on the limit is within it (see exceedsLimit) — for the forecast too.
  it('is green with the level exactly on the limit', () => {
    expect(judgeLimit(limit(LAEQ_30M, 65), record(65, 63)).state).toBe('ok');
  });

  // Nothing to forecast for a limit on the level itself or on a peak: broken or not, now.
  it('is only red or green for a limit with nothing to forecast', () => {
    expect(judgeLimit(limit(LAEQ, 65), record(68)).state).toBe('over');
    expect(judgeLimit(limit(LAEQ, 65), record(64)).state).toBe('ok');
    const peak = {laeq: encoded(90), lcpeak: encoded(100)} as NoiseRecording;
    const judged = judgeLimit(limit(LCPEAK, 120), peak);
    expect(judged.state).toBe('ok');
    expect(judged.current).toBeNull();
  });

  it('judges nothing without the window or a record', () => {
    expect(judgeLimit(limit(LAEQ_30M, 65), record(70)).state).toBeNull();
    expect(judgeLimit(limit(LAEQ_30M, 65), null).state).toBeNull();
  });
});

describe('decidingLimit', () => {
  it('ranks staying over above recovering', () => {
    // Window over on both; the LAeq limit is over now as well, the LAeq,30m's level now
    // is back under its 65.
    const deciding = decidingLimit(
      [limit(LAEQ_30M, 65), limit(LAEQ, 60)],
      record(62, 66),
    );
    expect(deciding?.limit.series).toBe(LAEQ);
    expect(deciding?.state).toBe('over');
  });

  it('ranks recovering above heading over', () => {
    // Two weightings, so each has a level now of its own: the LCeq,5m is under its 70 and
    // heading over it (the LCeq is 72), the LAeq,30m is over its 65 and heading back under
    // (the LAeq is 64).
    const near = limit('eq_5m:C' as SeriesKey, 70);
    const recovering = limit(LAEQ_30M, 65);
    const latest = {
      laeq: encoded(64),
      laeq30m: encoded(66),
      lceq: encoded(72),
      lceq5m: encoded(69),
    } as NoiseRecording;
    expect(judgeLimit(near, latest).state).toBe('near');
    const deciding = decidingLimit([near, recovering], latest);
    expect(deciding?.limit).toBe(recovering);
    expect(deciding?.state).toBe('recovering');
  });

  it('picks the limit in the worst state', () => {
    // LAeq 68 is over the 65 on the LAeq,30m's forecast (amber), and the LAeq limit of 70
    // is still green with less room than that one has on its window — amber still wins.
    const deciding = decidingLimit(
      [limit(LAEQ, 70), limit(LAEQ_30M, 65)],
      record(68, 60),
    );
    expect(deciding?.limit.series).toBe(LAEQ_30M);
    expect(deciding?.state).toBe('near');
  });

  it('breaks a tie of state on the least room left', () => {
    const deciding = decidingLimit(
      [limit(LAEQ, 70), limit(LAEQ_30M, 65)],
      record(60, 63),
    );
    // 10 dB to spare on the LAeq, 2 on the LAeq,30m.
    expect(deciding?.limit.series).toBe(LAEQ_30M);
    expect(deciding?.state).toBe('ok');
  });

  // A window the monitor hasn't filled yet has nothing to say, so it cannot outrank one
  // that has a reading — however tight its limit.
  it('passes over a limit with nothing to judge', () => {
    const deciding = decidingLimit(
      [limit(LAEQ_30M, 50), limit(LAEQ, 65)],
      record(60),
    );
    expect(deciding?.limit.series).toBe(LAEQ);
  });

  it('still names a limit when there is no current record', () => {
    const deciding = decidingLimit([limit(LAEQ, 65)], null);
    expect(deciding?.limit).toEqual(limit(LAEQ, 65));
    expect(deciding?.state).toBeNull();
  });

  it('is null with no limits', () => {
    expect(decidingLimit([], null)).toBeNull();
  });
});

describe('limitGlow', () => {
  // Colour for where the reading is; the chevron and the pulse for heading the other way —
  // and nothing at all for a reading within its limit and staying there.
  it('says where the reading is and which way it is heading', () => {
    expect(limitGlow('ok')).toBeNull();
    expect(limitGlow('near')).toEqual({
      color: 'yellow.400',
      direction: 'up',
      pulse: true,
    });
    expect(limitGlow('over')).toEqual({
      color: 'red.500',
      direction: null,
      pulse: false,
    });
    expect(limitGlow('recovering')).toEqual({
      color: 'red.500',
      direction: 'down',
      pulse: true,
    });
  });
});

describe('limitStateOf', () => {
  // The rule on its own, as a location card applies it to the playhead's readings.
  it('forecasts from the current level when there is one', () => {
    expect(limitStateOf(66, 70, 65)).toBe('over');
    expect(limitStateOf(66, 60, 65)).toBe('recovering');
    expect(limitStateOf(63, 70, 65)).toBe('near');
    expect(limitStateOf(63, 60, 65)).toBe('ok');
  });

  // Nothing to forecast with — a mean over a limit's own hours, or a series not read — is
  // only red or green.
  it('is only over or ok without a current level', () => {
    expect(limitStateOf(66, null, 65)).toBe('over');
    expect(limitStateOf(63, null, 65)).toBe('ok');
  });

  it('judges nothing without a reading', () => {
    expect(limitStateOf(null, 70, 65)).toBeNull();
  });
});
