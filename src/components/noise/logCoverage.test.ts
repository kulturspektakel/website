import {describe, expect, it} from 'vitest';
import {coverageGaps, thinGaps} from './logCoverage';
import {MINUTE_MS} from './timeframe';
import type {ProjectLogs} from './noise';

// The shading behind the timeline's ticks says "nothing was heard here". These pin the
// two things it must not do: report a stretch one monitor covered as missing, and lose a
// hole too narrow to draw.

const START = Date.parse('2026-07-25T20:00:00Z');
const at = (minute: number) => START + minute * MINUTE_MS;

const payload = (devices: ProjectLogs['devices']): ProjectLogs => ({
  start: START,
  stepMs: MINUTE_MS,
  minutes: 6,
  devices,
});

describe('coverageGaps', () => {
  it('finds nothing when a monitor reported throughout', () => {
    const logs = payload({'mic-1': {laeq_1m: [60, 60, 60, 60, 60, 60]}});
    expect(coverageGaps(logs)).toEqual([]);
  });

  it('unions the devices — one silent monitor is not a gap', () => {
    // mic-1 drops out over minutes 2–3, mic-2 is deployed for exactly those.
    const logs = payload({
      'mic-1': {laeq_1m: [60, 60, null, null, 60, 60]},
      'mic-2': {laeq_1m: [null, null, 70, 70, null, null]},
    });
    expect(coverageGaps(logs)).toEqual([]);
  });

  it('reports the stretch every monitor was silent for, and closes an open tail', () => {
    const logs = payload({
      'mic-1': {laeq_1m: [60, null, null, 60, null, null]},
      // A column absent entirely, which is what a device that said nothing all event
      // looks like once projectLogs has dropped it.
      'mic-2': {},
    });
    expect(coverageGaps(logs)).toEqual([
      {start: at(1), end: at(3)},
      // Runs to the payload's own edge and no further: past `minutes` we know nothing.
      {start: at(4), end: at(6)},
    ]);
  });
});

describe('thinGaps', () => {
  it('widens a sub-pixel hole and merges the neighbours that widening brings together', () => {
    // 600 minutes across 60 px: one pixel is ten minutes, so a one-minute hole is a
    // twentieth of one and must not simply vanish.
    const window = {start: START, end: at(600)};
    const [wide, ...rest] = thinGaps(
      [{start: at(100), end: at(101)}],
      window,
      60,
      2,
    );
    expect(rest).toEqual([]);
    // Two pixels' worth — twenty minutes — centred on the hole it stands for.
    expect(wide!.end - wide!.start).toBe(20 * MINUTE_MS);
    expect(wide!.start).toBe(at(90.5));

    // Two holes a few minutes apart both grow to 20 minutes and overlap, so they come
    // back as one span rather than two stacked ones.
    expect(
      thinGaps(
        [
          {start: at(100), end: at(101)},
          {start: at(105), end: at(106)},
        ],
        window,
        60,
        2,
      ),
    ).toEqual([{start: at(90.5), end: at(115.5)}]);
  });

  it('keeps a widened gap on the axis', () => {
    const window = {start: START, end: at(600)};
    expect(thinGaps([{start: START, end: at(1)}], window, 60, 2)).toEqual([
      {start: START, end: at(10.5)},
    ]);
  });
});
