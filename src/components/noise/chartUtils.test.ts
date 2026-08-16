import {describe, expect, it} from 'vitest';
import type uPlot from 'uplot';
import {
  dayOf,
  fmtHourMinute,
  gridStep,
  instantLabel,
  labelStride,
  timeGridStepS,
  weekdayOf,
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
    expect(fmtHourMinute(t)).toBe('18:05');
    expect(dayOf(zonedDate(t))).toBe('24.07.');
    expect(weekdayOf(zonedDate(t))).toBe('Fr');
  });

  it('zero-pad every field', () => {
    // 07:04:03 Berlin on the 3rd — every component is single-digit.
    const early = secs('2026-03-03T06:04:03Z');
    expect(fmtHourMinute(early)).toBe('07:04');
    expect(dayOf(zonedDate(early))).toBe('03.03.');
  });

  it('follow the offset across a DST boundary', () => {
    // Same wall-clock hour either side of the March change: UTC+1 then UTC+2.
    expect(fmtHourMinute(secs('2026-03-28T12:00:00Z'))).toBe('13:00');
    expect(fmtHourMinute(secs('2026-03-29T12:00:00Z'))).toBe('14:00');
  });

  it('cross midnight into the next local day', () => {
    // 22:00 UTC is midnight in Berlin, which is the instant the timeline draws a day
    // mark on — so both the date and the weekday have to turn over there rather than
    // two hours later.
    const midnight = zonedDate(secs('2026-07-24T22:00:00Z'));
    expect(dayOf(midnight)).toBe('25.07.');
    expect(weekdayOf(midnight)).toBe('Sa');
  });
});

describe('gridStep', () => {
  // The row charts' dB grid, which answers to height the way the time grid answers to
  // width: 30–110 dB up whatever box the chart was given, at least 14 px between lines.
  // The two heights that matter are the card floor and a device page's panel — the same
  // component, a factor of five apart, which is why the step cannot be a constant.
  const db = (heightPx: number) => gridStep([5, 10, 20, 40], 80, heightPx, 14);

  it('goes finer as the chart gets taller', () => {
    expect(db(113)).toBe(10); // a card at its minimum height
    expect(db(200)).toBe(10);
    expect(db(300)).toBe(5); // a device page's panel
    expect(db(800)).toBe(5); // and nothing finer than the ladder's floor
  });

  it('thins out rather than crowding a squeezed chart', () => {
    expect(db(90)).toBe(20);
    expect(db(40)).toBe(40);
  });

  it('never draws lines closer than the minimum spacing', () => {
    for (const h of [40, 90, 113, 150, 200, 300, 450, 600, 800]) {
      expect((db(h) * h) / 80).toBeGreaterThanOrEqual(14);
    }
  });

  // Every step divides the one above it, so growing a chart splits its gaps rather than
  // moving every line to a new offset.
  it('keeps the lines it had when it goes finer', () => {
    for (const [finer, coarser] of [
      [5, 10],
      [10, 20],
      [20, 40],
    ]) {
      expect(coarser! % finer!).toBe(0);
    }
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

// The one formatter here that speaks milliseconds, because it is shared with a readout
// that never had seconds to hand. Reading its argument in the wrong unit puts the label
// in 1970 rather than making it look wrong, so the unit is pinned first.
describe('instantLabel', () => {
  const ms = Date.parse('2026-07-24T18:05:09Z'); // Friday, 20:05:09 Berlin

  it('takes milliseconds where the axis formatters take seconds', () => {
    expect(instantLabel(false)(ms)).toBe('Fr 24.07. 20:05');
    // Seconds would land in 1970 — a label that is wrong rather than one that looks it.
    expect(instantLabel(false)(ms / 1000)).not.toContain('24.07.');
  });

  it('names the day whatever the window, that being the point', () => {
    // No span to consult any more: a crop of one evening says which evening.
    expect(instantLabel(false)(Date.parse('2026-07-25T22:30:00Z'))).toBe(
      'So 26.07. 00:30',
    );
  });

  it('reads to the second while live, and still names the day', () => {
    expect(instantLabel(true)(ms)).toBe('Fr 24.07. 20:05:09');
  });
});

// Which grid lines get a label, on all three axes in the section — the trace's time and
// dB axes and the spectrum's frequency one. It reaches uPlot only through valToPos, so a
// stub that scales a value into a pixel is the whole of what it needs.
describe('labelStride', () => {
  // `pxPerUnit` pixels per unit of the scale, which is all valToPos means here.
  const plotAt = (pxPerUnit: number) =>
    ({valToPos: (v: number) => v * pxPerUnit}) as unknown as uPlot;

  it('labels every line where the lines already clear the minimum', () => {
    // 10 dB apart at 4 px/dB is 40 px between labels, and 26 is what they need.
    expect(labelStride(plotAt(4), [30, 40, 50, 60], 'y', 26)).toBe(1);
  });

  it('skips as few as it can where they do not', () => {
    // 5 px between lines, 26 px wanted: every 6th survives.
    expect(labelStride(plotAt(0.5), [30, 40, 50, 60], 'y', 26)).toBe(6);
    // Exactly on the minimum is close enough — no line is skipped for a rounding.
    expect(labelStride(plotAt(2.6), [30, 40], 'y', 26)).toBe(1);
  });

  it('reads a descending axis by the gap and not its sign', () => {
    // uPlot's y grows downwards, so its pixels fall as the value rises.
    expect(labelStride(plotAt(-4), [30, 40, 50], 'y', 26)).toBe(1);
  });

  it('labels the line it has when there is nothing to measure against', () => {
    expect(labelStride(plotAt(4), [], 'x', 26)).toBe(1);
    expect(labelStride(plotAt(4), [30], 'x', 26)).toBe(1);
    // A collapsed scale: two splits on the same pixel would divide by zero.
    expect(labelStride(plotAt(0), [30, 40], 'x', 26)).toBe(1);
  });
});
