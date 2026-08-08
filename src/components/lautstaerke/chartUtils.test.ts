import {describe, expect, it} from 'vitest';
import {
  fmtDayHourMinute,
  fmtHourMinute,
  fmtTime,
  spanTimeFormat,
  timeGridStepS,
  zonedDate,
} from './chartUtils';

// The chart axes are labelled in festival-local time whatever zone the viewer is
// in, and these run per tick on every redraw. x values are unix epoch *seconds*,
// not milliseconds — which is the easiest thing to get wrong here.

const secs = (iso: string) => Date.parse(iso) / 1000;

describe('zonedDate', () => {
  it('reads epoch seconds as festival-local time', () => {
    // 16:05 UTC in summer is 18:05 in Berlin.
    const d = zonedDate(secs('2026-07-24T16:05:09Z'));
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([18, 5, 9]);
  });
});

describe('axis formatters', () => {
  const t = secs('2026-07-24T16:05:09Z'); // 18:05:09 Berlin

  it('render local time at their own precision', () => {
    expect(fmtTime(t)).toBe('18:05:09');
    expect(fmtHourMinute(t)).toBe('18:05');
    expect(fmtDayHourMinute(t)).toBe('24.07. 18:05');
  });

  it('zero-pad every field', () => {
    // 07:04:03 Berlin on the 3rd — every component is single-digit.
    const early = secs('2026-03-03T06:04:03Z');
    expect(fmtTime(early)).toBe('07:04:03');
    expect(fmtDayHourMinute(early)).toBe('03.03. 07:04');
  });

  it('follow the offset across a DST boundary', () => {
    // Same wall-clock hour either side of the March change: UTC+1 then UTC+2.
    expect(fmtHourMinute(secs('2026-03-28T12:00:00Z'))).toBe('13:00');
    expect(fmtHourMinute(secs('2026-03-29T12:00:00Z'))).toBe('14:00');
  });

  it('cross midnight into the next local day', () => {
    // 22:30 UTC is 00:30 the next day in Berlin.
    expect(fmtDayHourMinute(secs('2026-07-24T22:30:00Z'))).toBe('25.07. 00:30');
  });
});

describe('timeGridStepS', () => {
  // The row charts' vertical grid. A row is ~400 px wide and asks for at least
  // 56 px between lines, so the step is whatever clock interval that allows.
  const step = (spanSeconds: number, widthPx = 400) =>
    timeGridStepS(spanSeconds, widthPx, 56);

  it('picks the clock interval that fits the window', () => {
    expect(step(5 * 60)).toBe(60); // the live window: minute lines
    expect(step(60 * 60)).toBe(15 * 60); // an hour: quarter hours
    expect(step(6 * 60 * 60)).toBe(60 * 60); // an afternoon: full hours
    expect(step(24 * 60 * 60)).toBe(6 * 60 * 60);
    expect(step(4 * 24 * 60 * 60)).toBe(24 * 60 * 60); // a festival: daily
  });

  it('never draws lines closer than the minimum spacing', () => {
    for (const days of [0.01, 0.1, 1, 2, 4, 7, 30, 365]) {
      const span = days * 24 * 60 * 60;
      const lines = span / step(span);
      expect(lines).toBeLessThanOrEqual(400 / 56);
    }
  });

  it('goes finer as the row gets wider, same window', () => {
    // The step is a function of pixels per second, not of the window alone: the
    // live window drops to half-minute lines once there is room for them.
    expect(step(5 * 60, 800)).toBe(30);
    expect(step(5 * 60, 200)).toBe(5 * 60);
  });

  it('holds the finest step for a window finer than the ladder', () => {
    // Nothing below half a minute, however few seconds are on screen — a second
    // grid on a level chart is noise.
    expect(step(20)).toBe(30);
    expect(step(1)).toBe(30);
  });

  it('widens beyond the ladder rather than returning an unusable step', () => {
    // uPlot loops forever on a zero increment, so a window wider than the ladder
    // covers still has to come back with something that fits.
    const span = 10 * 365 * 24 * 60 * 60;
    const chosen = step(span);
    expect(chosen).toBeGreaterThan(24 * 60 * 60);
    expect(span / chosen).toBeLessThanOrEqual(400 / 56);
  });

  it('is never zero, whatever it is handed', () => {
    expect(timeGridStepS(0, 400, 56)).toBe(30);
    expect(timeGridStepS(-1, 400, 56)).toBe(30);
    expect(timeGridStepS(3600, 0, 56)).toBeGreaterThan(0);
  });
});

// Which label a window that wide wants. The boundary is the whole point: at a day the
// same clock time comes round again, so HH:MM stops being an answer.
describe('spanTimeFormat', () => {
  const HOUR = 60 * 60 * 1000;
  const ts = Date.parse('2026-07-24T18:05:09Z') / 1000;

  it('leaves the date off a window shorter than a day', () => {
    expect(spanTimeFormat(6 * HOUR)(ts)).toBe('20:05');
    expect(spanTimeFormat(23.99 * HOUR)(ts)).toBe('20:05');
  });

  it('carries the date from a day upwards', () => {
    expect(spanTimeFormat(24 * HOUR)(ts)).toBe('24.07. 20:05');
    expect(spanTimeFormat(4 * 24 * HOUR)(ts)).toBe('24.07. 20:05');
  });
});
