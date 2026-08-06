import {describe, expect, it} from 'vitest';
import {fmtDayHourMinute, fmtHourMinute, fmtTime, zonedDate} from './chartUtils';

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
