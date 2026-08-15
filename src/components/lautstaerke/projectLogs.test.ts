import {describe, expect, it} from 'vitest';
import {
  levelsByDevice,
  locationEnergyIndex,
  locationRangeTotals,
  logColumn,
  logSeries,
  totalsByLocation,
} from './projectLogs';
import {LEVEL_METRICS, supportedMetric} from './level';
import {coverageDetail, energeticMeanDb} from './leq';
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
      // The maxima the picker can also be set to; peak is C-weighted only.
      lafmax: [80, 90, null, 100],
      lcfmax: [85, 95, null, 105],
      lcpeak: [91, 101, null, 111],
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
  // The picker's metric→column mapping goes through the series table, so every
  // enabled combination has to resolve — otherwise switching to dB(C) reads nothing.
  it('resolves every enabled option under both weightings', () => {
    for (const metric of LEVEL_METRICS) {
      for (const weighting of ['A', 'C'] as const) {
        // LCpeak has no A-weighted twin, and the picker disables it there rather
        // than asking for it.
        if (supportedMetric(metric, weighting) !== metric) continue;
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
    expect(logColumn(logs, 'mic-1', 'peak', 'C')?.[1]).toBe(101);
  });

  it('has nothing for an unknown device', () => {
    expect(logColumn(logs, 'nobody', 'eq_fast', 'A')).toBeUndefined();
  });
});

// Where the monitors stood. `mic-1` has the place to itself for the first two minutes;
// `mic-2` joins for the last two, so minutes 2 and 3 are the case the envelope is for.
const nord = {
  id: 'nord',
  assignments: [
    {deviceId: 'mic-1', start: START, end: null},
    {deviceId: 'mic-2', start: at(2), end: null},
  ],
};
// One monitor, and only for the first two minutes — a place that stood empty afterwards.
const sued = {
  id: 'sued',
  assignments: [{deviceId: 'mic-1', start: START, end: at(2)}],
};

describe('locationRangeTotals', () => {
  // The index is what every Leq on the page is read off; building one per weighting
  // here is what the project page's own memo does.
  const indexed = {
    A: locationEnergyIndex(logs, 'A', [nord, sued]),
    C: locationEnergyIndex(logs, 'C', [nord, sued]),
  };
  const totalsOf = (
    weighting: 'A' | 'C',
    locationId: string,
    range: {start: number; end: number},
  ) => locationRangeTotals(indexed[weighting], locationId, range);
  const leqOf = (...args: Parameters<typeof totalsOf>) =>
    totalsOf(...args)?.db ?? null;

  it('averages the window energetically, not arithmetically', () => {
    const leq = leqOf('A', 'nord', {start: START, end: at(2)});
    expect(leq).toBeCloseTo(energeticMeanDb([60, 70])!, 10);
    expect(leq).toBeCloseTo(67.4, 1);
  });

  // The load-bearing one: at minute 3 both monitors report (mic-1 80, mic-2 90) and the
  // place's level is the louder of them. Averaging the two monitors' own Leqs, or
  // averaging every reading, would both answer something quieter than the place was.
  it('takes the loudest monitor at each minute', () => {
    // Minute 2: only mic-2 (90). Minute 3: mic-1 80 and mic-2 90 → 90.
    expect(leqOf('A', 'nord', {start: at(2), end: at(4)})).toBeCloseTo(90, 10);
  });

  // A monitor's minutes at another location are not this one's, however loud they were.
  it('ignores a monitor outside the window it stood here', () => {
    const whole = {start: START, end: at(4)};
    // mic-1 alone, and only its first two minutes — minute 3's 80 dB was measured after
    // it had been carried away.
    expect(leqOf('A', 'sued', whole)).toBeCloseTo(
      energeticMeanDb([60, 70])!,
      10,
    );
  });

  // The counts that turn "90 dB over the crop" into "90 dB, over half of it" — the
  // whole reason the Leq and its coverage travel together. `expectedMinutes` is the
  // minutes a monitor was assigned *here*, so the two empty minutes are not charged to
  // the location and the minute nobody reported is.
  it('reports how much of its assigned time the mean actually had', () => {
    const whole = {start: START, end: at(4)};
    expect(totalsOf('A', 'sued', whole)).toMatchObject({
      minutes: 2,
      expectedMinutes: 2,
    });
    // Nothing to disclose: the place had a reading for every minute it had a monitor,
    // even though that was only half the crop.
    expect(coverageDetail(totalsOf('A', 'sued', whole)!)).toBeUndefined();
    expect(totalsOf('A', 'nord', whole)).toMatchObject({
      // Minute 2 has only mic-2's 90; minute 3 has both. Minute 2 of mic-1's own column
      // is null, but the place still had a reading.
      minutes: 4,
      expectedMinutes: 4,
    });
    const partial = locationRangeTotals(
      locationEnergyIndex(logs, 'A', [
        {
          id: 'gap',
          assignments: [{deviceId: 'mic-1', start: START, end: null}],
        },
      ]),
      'gap',
      whole,
    );
    // mic-1 is silent for minute 2 while still standing there — a gap the location is
    // charged for, which is exactly what the caveat is meant to say. (One missing
    // minute is under the threshold worth telling anyone about; see coverageDetail.)
    expect(partial).toMatchObject({minutes: 3, expectedMinutes: 4});
  });

  it('is null for a window with nothing in it, or an empty window', () => {
    expect(totalsOf('A', 'sued', {start: at(2), end: at(4)})).toBeNull();
    expect(totalsOf('A', 'nord', {start: at(2), end: at(2)})).toBeNull();
  });

  it('is null for a location the index does not know', () => {
    expect(totalsOf('A', 'nowhere', {start: START, end: at(4)})).toBeNull();
  });

  it('clamps a window reaching outside the payload', () => {
    const beyond = {start: START - 10 * MINUTE_MS, end: at(99)};
    expect(leqOf('A', 'sued', beyond)).toBeCloseTo(
      energeticMeanDb([60, 70])!,
      10,
    );
  });

  // The whole point of the index: it must answer exactly what a direct pass over the
  // column would, for every sub-range of it — including the ones that start or end on
  // a minute nothing was reported.
  it('matches a direct energetic mean over every sub-range', () => {
    const column = logs.devices['mic-1']!.laeq_1m!;
    const alone = locationEnergyIndex(logs, 'A', [
      {id: 'one', assignments: [{deviceId: 'mic-1', start: START, end: null}]},
    ]);
    for (let from = 0; from <= logs.minutes; from++) {
      for (let to = from; to <= logs.minutes; to++) {
        expect(
          locationRangeTotals(alone, 'one', {start: at(from), end: at(to)})
            ?.db ?? null,
        ).toBe(energeticMeanDb(column, from, to));
      }
    }
  });
});

describe('levelsByDevice', () => {
  it('reads the playhead minute for the selected window', () => {
    expect(
      levelsByDevice(logs, {metric: 'eq_fast', weighting: 'A', minute: 1}),
    ).toEqual({'mic-1': 70});
  });

  it('follows the weighting and the window', () => {
    expect(
      levelsByDevice(logs, {metric: 'eq_5m', weighting: 'C', minute: 3}),
    ).toEqual({'mic-1': 86});
  });

  // A device with no reading for the selected minute is left out rather than carried
  // as null: absent and unmeasured render identically, and consumers key on presence.
  it('omits a device with no value at the playhead', () => {
    expect(
      levelsByDevice(logs, {metric: 'eq_fast', weighting: 'A', minute: 2}),
    ).toEqual({'mic-2': 90});
  });

  it('omits everyone for a window no device reports', () => {
    expect(
      levelsByDevice(logs, {metric: 'eq_30m', weighting: 'A', minute: 1}),
    ).toEqual({});
  });
});

// The number every card leads with, and the reason it is no longer a picker option:
// it answers a different question from the one above — the crop, not the instant.
describe('totalsByLocation', () => {
  const range = {start: START, end: at(4)};

  it('averages the crop for every location, playhead or not', () => {
    const totals = totalsByLocation(
      locationEnergyIndex(logs, 'A', [nord, sued]),
      range,
    );
    // The louder of the two at each minute: 60, 70, 90, 90.
    expect(totals['nord']?.db).toBeCloseTo(
      energeticMeanDb([60, 70, 90, 90])!,
      10,
    );
    expect(totals['sued']?.db).toBeCloseTo(energeticMeanDb([60, 70])!, 10);
  });

  it('omits a location with nothing in the crop', () => {
    expect(
      Object.keys(
        totalsByLocation(locationEnergyIndex(logs, 'A', [nord, sued]), {
          start: at(2),
          end: at(4),
        }),
      ),
    ).toEqual(['nord']);
  });
});

describe('logSeries', () => {
  it('hands over the whole stored column, not a crop of it', () => {
    // uPlot clips and decimates, so this is deliberately full resolution and
    // project-length — that is what makes a crop drag cost nothing here.
    const series = logSeries(logs, ['eq_fast'], 'A').eq_fast!;
    expect(series['mic-1']!.db).toEqual([60, 70, null, 80]);
    expect(series['mic-1']!.xs).toEqual(
      [at(0), at(1), at(2), at(3)].map((ms) => ms / 1000),
    );
  });

  it('follows the weighting', () => {
    expect(logSeries(logs, ['eq_fast'], 'C').eq_fast!['mic-1']!.db).toEqual([
      65,
      75,
      null,
      85,
    ]);
  });

  // A picked window is a stored column, so a row's line is the device's own trailing Leq —
  // never a rollup of the 1m one, which would average twice.
  it('plots the trailing window the header asks for', () => {
    expect(logSeries(logs, ['eq_5m'], 'A').eq_5m!['mic-1']!.db).toEqual([
      null,
      71,
      null,
      81,
    ]);
    // A window the payload never carried is no trace at all, not a flat line — but the
    // entry is there, because it was asked for: the chart has a series for every window it
    // ticked, and one that quietly went missing would shift every column after it.
    expect(logSeries(logs, ['eq_30m'], 'A')).toEqual({eq_30m: {}});
  });

  // One record per picked window, and an empty one among them disturbs nothing.
  it('answers every window asked for, in one pass over the payload', () => {
    const traces = logSeries(logs, ['eq_fast', 'eq_30m', 'eq_5m'], 'A');
    expect(Object.keys(traces).sort()).toEqual([
      'eq_30m',
      'eq_5m',
      'eq_fast',
    ]);
    expect(traces.eq_fast!['mic-1']!.db).toEqual([60, 70, null, 80]);
    expect(traces.eq_5m!['mic-1']!.db).toEqual([null, 71, null, 81]);
    expect(traces.eq_30m).toEqual({});
  });

  // One array of timestamps for every device: they are all the same minutes, and a
  // copy per device would be the largest allocation on the page for no reason.
  it('shares one x column across devices', () => {
    const series = logSeries(logs, ['eq_fast'], 'A').eq_fast!;
    expect(series['mic-1']!.xs).toBe(series['mic-2']!.xs);
  });

  // And across windows, which is what the aligners lean on: the projection has one x
  // column, so five windows must not arrive on five equal-but-separate grids.
  it('shares one x column across windows too', () => {
    const traces = logSeries(logs, ['eq_fast', 'eq_5m'], 'A');
    expect(traces.eq_fast!['mic-2']!.xs).toBe(traces.eq_5m!['mic-1']!.xs);
  });

  // The nulls travel rather than being stripped, which is what lets the x column be
  // shared — and what makes uPlot break the line where a monitor wasn't deployed.
  it('keeps a device that reported only part of the project, nulls and all', () => {
    expect(logSeries(logs, ['eq_fast'], 'A').eq_fast!['mic-2']!.db).toEqual([
      null,
      null,
      90,
      90,
    ]);
  });

  it('omits a device with no column at all', () => {
    const empty = {...logs, devices: {'mic-3': {}}};
    expect(logSeries(empty, ['eq_fast'], 'A')).toEqual({eq_fast: {}});
  });
});
