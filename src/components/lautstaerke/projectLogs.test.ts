import {describe, expect, it} from 'vitest';
import {levelsByDevice, logColumn, logRangeLeq, logSeries} from './projectLogs';
import {POINT_METRICS} from './level';
import {energeticMeanDb} from './leq';
import {MINUTE_MS} from './timeframe';
import {logMinuteIndex, type ProjectLogs} from './noise';

// The whole event lives in the browser as one minute-indexed column per window per
// weighting, so every number the page shows is an index or a slice. These pin what
// "no value" means, since three different absences — unreported, not-yet-filled, and
// not-deployed-here — all arrive as null and must all read the same.

const START = Date.parse('2026-07-25T20:00:00Z');
const at = (minute: number) => START + minute * MINUTE_MS;

// Four minutes, one device. The 30m columns are absent entirely, which is what a
// short event looks like once projectLogs drops columns that were null throughout.
const logs: ProjectLogs = {
  start: START,
  stepMs: MINUTE_MS,
  minutes: 4,
  devices: {
    'mic-1': {
      laeq_1m: [60, 70, null, 80],
      lceq_1m: [65, 75, null, 85],
      laeq_5m: [null, 71, null, 81],
      lceq_5m: [null, 76, null, 86],
    },
    // Deployed for the last two minutes only — the earlier ones are nulls that
    // projectLogs clipped away, not silence.
    'mic-2': {
      laeq_1m: [null, null, 90, 90],
      lceq_1m: [null, null, 95, 95],
    },
  },
};

describe('logMinuteIndex', () => {
  it('maps an instant onto its minute', () => {
    expect(logMinuteIndex(logs, START)).toBe(0);
    expect(logMinuteIndex(logs, at(2))).toBe(2);
    // Anywhere inside a minute belongs to it, as with floorToMinute.
    expect(logMinuteIndex(logs, at(2) + 59_999)).toBe(2);
  });

  it('reports instants outside the payload as out of range', () => {
    expect(logMinuteIndex(logs, START - 1)).toBeLessThan(0);
    expect(logMinuteIndex(logs, at(9))).toBeGreaterThanOrEqual(logs.minutes);
  });
});

describe('logColumn', () => {
  // The picker's window→column mapping goes through the series table, so every
  // offered combination has to resolve — otherwise switching to dB(C) reads nothing.
  it('resolves every offered window under both weightings', () => {
    for (const metric of POINT_METRICS) {
      for (const weighting of ['A', 'C'] as const) {
        // eq_30m was dropped from this payload, so absent is a valid answer; what
        // must not happen is resolving to the wrong column.
        const column = logColumn(logs, 'mic-1', metric, weighting);
        if (metric === 'eq_30m') expect(column).toBeUndefined();
        else expect(column).toHaveLength(logs.minutes);
      }
    }
  });

  it('reads the weighting the caller asked for', () => {
    expect(logColumn(logs, 'mic-1', 'eq_fast', 'A')?.[1]).toBe(70);
    expect(logColumn(logs, 'mic-1', 'eq_fast', 'C')?.[1]).toBe(75);
    expect(logColumn(logs, 'mic-1', 'eq_5m', 'C')?.[1]).toBe(76);
  });

  // 'total' can't even be asked for: it is a range aggregate with no column, and the
  // parameter type says so rather than a runtime branch.
  it('has nothing for an unknown device', () => {
    expect(logColumn(logs, 'nobody', 'eq_fast', 'A')).toBeUndefined();
  });
});

describe('logRangeLeq', () => {
  it('averages the window energetically, not arithmetically', () => {
    const leq = logRangeLeq(logs, 'mic-1', {start: START, end: at(2)}, 'A');
    expect(leq).toBeCloseTo(energeticMeanDb([60, 70])!, 10);
    expect(leq).toBeCloseTo(67.4, 1);
  });

  // The one that matters for a monitor deployed partway through: its Leq is over the
  // minutes it was actually there, not over the crop's whole span. Counting the
  // clipped minutes as silence would drag the level down and misreport it.
  it('averages only the minutes a device has, not the whole crop', () => {
    const whole = {start: START, end: at(4)};
    expect(logRangeLeq(logs, 'mic-2', whole, 'A')).toBeCloseTo(90, 10);
    expect(logRangeLeq(logs, 'mic-2', whole, 'C')).toBeCloseTo(95, 10);
  });

  it('is null for a window with nothing in it, or an empty window', () => {
    expect(
      logRangeLeq(logs, 'mic-2', {start: START, end: at(2)}, 'A'),
    ).toBeNull();
    expect(
      logRangeLeq(logs, 'mic-1', {start: at(2), end: at(2)}, 'A'),
    ).toBeNull();
  });

  it('clamps a window reaching outside the payload', () => {
    const beyond = {start: START - 10 * MINUTE_MS, end: at(99)};
    expect(logRangeLeq(logs, 'mic-1', beyond, 'A')).toBeCloseTo(
      energeticMeanDb([60, 70, 80])!,
      10,
    );
  });
});

describe('levelsByDevice', () => {
  const range = {start: START, end: at(4)};

  it('reads the playhead minute for an instantaneous window', () => {
    expect(
      levelsByDevice(logs, {
        metric: 'eq_fast',
        weighting: 'A',
        current: at(1),
        range,
      }),
    ).toEqual({'mic-1': 70});
  });

  it('follows the weighting and the window', () => {
    expect(
      levelsByDevice(logs, {
        metric: 'eq_5m',
        weighting: 'C',
        current: at(3),
        range,
      }),
    ).toEqual({'mic-1': 86});
  });

  // A device with no reading for the selected minute is left out rather than carried
  // as null: absent and unmeasured render identically, and consumers key on presence.
  it('omits a device with no value at the playhead', () => {
    expect(
      levelsByDevice(logs, {
        metric: 'eq_fast',
        weighting: 'A',
        current: at(2),
        range,
      }),
    ).toEqual({'mic-2': 90});
  });

  it('omits everyone for a window no device reports', () => {
    expect(
      levelsByDevice(logs, {
        metric: 'eq_30m',
        weighting: 'A',
        current: at(1),
        range,
      }),
    ).toEqual({});
  });

  it('averages the crop instead of the playhead for the range Leq', () => {
    const levels = levelsByDevice(logs, {
      metric: 'total',
      weighting: 'A',
      // Deliberately a minute nobody reported: the range Leq must not read it.
      current: at(2),
      range,
    });
    expect(levels['mic-1']).toBeCloseTo(energeticMeanDb([60, 70, 80])!, 10);
    expect(levels['mic-2']).toBeCloseTo(90, 10);
  });
});

describe('logSeries', () => {
  it('hands over the whole stored column, not a crop of it', () => {
    // uPlot clips and decimates, so this is deliberately full resolution and
    // project-length — that is what makes a crop drag cost nothing here.
    const series = logSeries(logs, 'A');
    expect(series['mic-1']!.db).toEqual([60, 70, null, 80]);
    expect(series['mic-1']!.xs).toEqual(
      [at(0), at(1), at(2), at(3)].map((ms) => ms / 1000),
    );
  });

  it('follows the weighting', () => {
    expect(logSeries(logs, 'C')['mic-1']!.db).toEqual([65, 75, null, 85]);
  });

  // One array of timestamps for every device: they are all the same minutes, and a
  // copy per device would be the largest allocation on the page for no reason.
  it('shares one x column across devices', () => {
    const series = logSeries(logs, 'A');
    expect(series['mic-1']!.xs).toBe(series['mic-2']!.xs);
  });

  // The nulls travel rather than being stripped, which is what lets the x column be
  // shared — and what makes uPlot break the line where a monitor wasn't deployed.
  it('keeps a device that reported only part of the project, nulls and all', () => {
    expect(logSeries(logs, 'A')['mic-2']!.db).toEqual([null, null, 90, 90]);
  });

  it('omits a device with no column at all', () => {
    const empty = {...logs, devices: {'mic-3': {}}};
    expect(logSeries(empty, 'A')).toEqual({});
  });
});
