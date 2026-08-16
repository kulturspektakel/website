import {describe, expect, it} from 'vitest';
import {batteryHoursLeft, batteryPercent} from './batteryCurve';

describe('batteryPercent', () => {
  // The table's own ends and its middle sample, which pin that the index is read as the
  // percentage and not off by one: 1884 mV is entry 50.
  it('reads a table value back as its index', () => {
    expect(batteryPercent(1500)).toBe(0);
    expect(batteryPercent(1884)).toBe(50);
    expect(batteryPercent(2085)).toBe(100);
  });

  // Between two samples, so that six millivolts of drift are not six millivolts of the same
  // number. 1886 sits two of the four millivolts from entry 50 (1884) to entry 51 (1888).
  it('interpolates between samples', () => {
    expect(batteryPercent(1886)).toBeCloseTo(50.5, 6);
  });

  // Off either end the curve stops rather than extrapolating — a flat cell and one on the
  // charger are both outside what was measured.
  it('clamps outside the measured range', () => {
    expect(batteryPercent(1400)).toBe(0);
    expect(batteryPercent(2200)).toBe(100);
  });
});

// The measurement's hours-left column was this curve times a constant at every step, and
// only the constant was kept — a full cell has to come back out as the figure it ended on.
describe('batteryHoursLeft', () => {
  it('reproduces the runtime of a full cell', () => {
    expect(batteryHoursLeft(2085)).toBeCloseTo(37.92, 6);
    expect(batteryHoursLeft(1884)).toBeCloseTo(18.96, 6);
  });
});
