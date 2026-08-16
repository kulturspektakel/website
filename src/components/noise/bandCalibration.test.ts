import {describe, expect, it} from 'vitest';
import {CAL_BAND_COUNT} from './bluetooth';
import {
  CALIBRATION_SAMPLES,
  createCalibrationRun,
  SETTLE_SAMPLES,
} from './bandCalibration';

// One second of an instrument reading the same level in every band, which is all most of these
// need: what is under test is the averaging and the discarding, not the per-band bookkeeping.
const flat = (db: number | null) =>
  new Array<number | null>(CAL_BAND_COUNT).fill(db);

// A run past its settle window, so `add` counts from the next call on.
const settled = () => {
  const run = createCalibrationRun();
  for (let i = 0; i < SETTLE_SAMPLES; i++) run.add(flat(0), flat(0));
  return run;
};

describe('createCalibrationRun', () => {
  it('averages levels over power, not over decibels', () => {
    const run = settled();
    run.add(flat(60), flat(50));
    run.add(flat(70), flat(50));
    const {device, reference, difference} = run.result();
    // 60 and 70 dB are 67.4 dB together, not 65 — the arithmetic mean of two decibel figures is
    // not a level. See leq.ts, which owns this.
    expect(device[0]!).toBeCloseTo(67.4, 1);
    expect(reference[0]!).toBeCloseTo(50, 6);
    expect(difference[0]!).toBeCloseTo(17.4, 1);
  });

  it('reads positive where the monitor is the louder of the two', () => {
    const run = settled();
    run.add(flat(84), flat(80));
    // The sign is the finding: +4 means the monitor reads 4 dB high, and a trim would have to
    // take 4 dB off. Backwards, it would add them.
    expect(run.result().difference[0]!).toBeCloseTo(4, 6);
  });

  it('throws away the settle seconds', () => {
    const run = createCalibrationRun();
    // Loud enough that including even one of these would be obvious: 100 dB is ten times the
    // power of 90.
    for (let i = 0; i < SETTLE_SAMPLES; i++) run.add(flat(100), flat(100));
    expect(run.samples()).toBe(0);
    expect(run.seconds()).toBe(SETTLE_SAMPLES);

    for (let i = 0; i < CALIBRATION_SAMPLES; i++) run.add(flat(70), flat(60));
    expect(run.samples()).toBe(CALIBRATION_SAMPLES);
    expect(run.seconds()).toBe(SETTLE_SAMPLES + CALIBRATION_SAMPLES);
    const {device, difference, samples} = run.result();
    expect(device[0]!).toBeCloseTo(70, 6);
    expect(difference[0]!).toBeCloseTo(10, 6);
    expect(samples).toBe(CALIBRATION_SAMPLES);
  });

  it('counts each band for itself', () => {
    const run = settled();
    // A band the microphone reported nothing in for one of the two seconds — bandDb returns null
    // for a band no energy landed in, and it is a per-band answer rather than a per-second one.
    const partial = flat(60);
    partial[5] = null;
    run.add(flat(70), partial);
    run.add(flat(70), flat(60));
    const {reference, difference} = run.result();
    // The band that was reported once averages that one second rather than being dragged
    // halfway to silence.
    expect(reference[5]!).toBeCloseTo(60, 6);
    expect(difference[5]!).toBeCloseTo(10, 6);
  });

  it('leaves a band null when neither second measured it', () => {
    const run = settled();
    const silent = flat(60);
    silent[0] = null;
    run.add(flat(70), silent);
    run.add(flat(70), silent);
    const {reference, difference} = run.result();
    // Null all the way out, so the chart leaves a gap. A zero here would read as two instruments
    // agreeing exactly, which is the opposite of what happened.
    expect(reference[0]).toBeNull();
    expect(difference[0]).toBeNull();
    expect(difference[1]!).toBeCloseTo(10, 6);
  });

  it('ignores readings that are not levels', () => {
    const run = settled();
    // −Infinity is what a silent FFT bin comes out as before anything nulls it, and NaN is what
    // an empty bar is drawn with. Neither is a measurement.
    run.add(flat(-Infinity), flat(NaN));
    run.add(flat(70), flat(60));
    const {device, reference} = run.result();
    expect(device[0]!).toBeCloseTo(70, 6);
    expect(reference[0]!).toBeCloseTo(60, 6);
  });

  it('has nothing to say before anything has been added', () => {
    const {difference, samples} = createCalibrationRun().result();
    expect(samples).toBe(0);
    expect(difference).toHaveLength(CAL_BAND_COUNT);
    expect(difference.every((v) => v == null)).toBe(true);
  });
});
