import {describe, expect, it} from 'vitest';
import {CAL_BAND_COUNT, CAL_MAX_DB} from './bluetooth';
import {
  aWeightedDb,
  CALIBRATION_SAMPLES,
  createCalibrationRun,
  railedBands,
  SETTLE_SAMPLES,
  trimsForResult,
} from './bandCalibration';

// One second of an instrument reading the same level in every band, which is all most of these
// need: what is under test is the averaging and the discarding, not the per-band bookkeeping.
const flat = (db: number | null) =>
  new Array<number | null>(CAL_BAND_COUNT).fill(db);

// A run past its settle window, so `add` counts from the next call on.
const settled = () => {
  const run = createCalibrationRun();
  for (let i = 0; i < SETTLE_SAMPLES; i++) run.add(flat(0), flat(0), null);
  return run;
};

describe('createCalibrationRun', () => {
  it('averages levels over power, not over decibels', () => {
    const run = settled();
    run.add(flat(60), flat(50), null);
    run.add(flat(70), flat(50), null);
    const {device, reference, difference} = run.result();
    // 60 and 70 dB are 67.4 dB together, not 65 — the arithmetic mean of two decibel figures is
    // not a level. See leq.ts, which owns this.
    expect(device[0]!).toBeCloseTo(67.4, 1);
    expect(reference[0]!).toBeCloseTo(50, 6);
    expect(difference[0]!).toBeCloseTo(17.4, 1);
  });

  it('reads positive where the monitor is the louder of the two', () => {
    const run = settled();
    run.add(flat(84), flat(80), null);
    // The sign is the finding: +4 means the monitor reads 4 dB high, and a trim would have to
    // take 4 dB off. Backwards, it would add them.
    expect(run.result().difference[0]!).toBeCloseTo(4, 6);
  });

  it('throws away the settle seconds', () => {
    const run = createCalibrationRun();
    // Loud enough that including even one of these would be obvious: 100 dB is ten times the
    // power of 90.
    for (let i = 0; i < SETTLE_SAMPLES; i++)
      run.add(flat(100), flat(100), null);
    expect(run.samples()).toBe(0);
    expect(run.seconds()).toBe(SETTLE_SAMPLES);

    for (let i = 0; i < CALIBRATION_SAMPLES; i++)
      run.add(flat(70), flat(60), null);
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
    run.add(flat(70), partial, null);
    run.add(flat(70), flat(60), null);
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
    run.add(flat(70), silent, null);
    run.add(flat(70), silent, null);
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
    run.add(flat(-Infinity), flat(NaN), null);
    run.add(flat(70), flat(60), null);
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

// A full set of bands with a few of them named — trims on the device, or a run's finding,
// which are the same shape and differ only in whether a band may be null.
const bands = <T>(set: Record<number, T>, base: T): T[] =>
  Array.from({length: CAL_BAND_COUNT}, (_, b) => (b in set ? set[b]! : base));
const trims = (set: Record<number, number> = {}) => bands(set, 0);
const diff = (set: Record<number, number | null> = {}) =>
  bands<number | null>(set, 0);

describe('trimsForResult', () => {
  it('trims down where the monitor reads high', () => {
    // The whole point of the function, and the one assertion that catches the sign being
    // inverted: +4 means the monitor is 4 dB above the reference, so the correction takes 4 dB
    // off. See trimsForResult, which derives this from the firmware's convention.
    expect(trimsForResult(trims(), diff({0: 4}))[0]).toBe(-4);
  });

  it('trims up where the monitor reads low', () => {
    expect(trimsForResult(trims(), diff({0: -4}))[0]).toBe(4);
  });

  it('corrects the trims in force rather than replacing them', () => {
    // A monitor already trimmed +2 that still reads 4 dB high needs to end at −2, not at −4:
    // the +2 was part of what was measured.
    expect(trimsForResult(trims({0: 2}), diff({0: 4}))[0]).toBe(-2);
  });

  it('leaves a band it learned nothing about alone', () => {
    // Null is "not measured", not "no difference". Zeroing here would throw away a good trim.
    expect(trimsForResult(trims({3: 1.5}), diff({3: null}))[3]).toBe(1.5);
  });

  it("puts the correction through the wire's step and range", () => {
    // snapTrim owns both rules and is tested in bluetooth.test.ts; what matters here is that
    // this function applies them, rather than handing the encoder a trim it will alter.
    expect(trimsForResult(trims(), diff({0: -0.3}))[0]).toBe(0.5);
    expect(trimsForResult(trims(), diff({0: -100}))[0]).toBe(CAL_MAX_DB);
  });

  it('returns one trim per band, whatever it was handed', () => {
    // The device's characteristic is a fixed 31 bytes, and a short array here would silently
    // become zeros on the wire — see encodeCalibration.
    expect(trimsForResult([], diff())).toHaveLength(CAL_BAND_COUNT);
    expect(trimsForResult(trims(), [])).toHaveLength(CAL_BAND_COUNT);
  });

  it('carries a whole measured curve across, band for band', () => {
    // Band alignment, which the null case is the usual way of breaking: the trim for 1 kHz has
    // to come out at the 1 kHz index and nowhere else.
    const next = trimsForResult(
      trims({0: 1, 18: -3}),
      diff({0: 2, 9: null, 18: 1.5}),
    );
    expect(next[0]).toBe(-1);
    expect(next[9]).toBe(0);
    expect(next[18]).toBe(-4.5);
  });
});

describe('railedBands', () => {
  it('counts only the bands the range could not hold', () => {
    expect(railedBands(trims(), diff({0: -100, 5: 2, 9: 100}))).toBe(2);
  });

  it('counts a band the held trim pushed past the rail', () => {
    // The correction is what gets clamped, not the difference: 20 dB of existing trim plus a
    // further 10 asked for is past the limit, though neither number is on its own.
    expect(railedBands(trims({0: 20}), diff({0: -10}))).toBe(1);
  });

  it('does not count a band nothing was measured in', () => {
    // Unmeasured means the held trim is kept, and a trim already on the device is in range.
    expect(railedBands(trims({0: CAL_MAX_DB}), diff({0: null}))).toBe(0);
  });

  it('is silent on a correction the range holds', () => {
    expect(railedBands(trims(), diff({0: 4, 1: -4}))).toBe(0);
  });
});

describe('aWeightedDb', () => {
  // A single band carrying everything, so the figure under test is the weight at that band
  // plus nothing else. Index 18 is 1 kHz, where A-weighting is 0 dB by definition.
  const oneBand = (index: number, db: number) => {
    const bands = new Array<number | null>(CAL_BAND_COUNT).fill(null);
    bands[index] = db;
    return bands;
  };

  it('leaves 1 kHz alone', () => {
    expect(aWeightedDb(oneBand(18, 70))!).toBeCloseTo(70, 6);
  });

  it('applies the weight at the band, with its sign', () => {
    // 16 Hz is −56.7 dB, which is the whole reason an unweighted spectrum and an LAeq are
    // different numbers: a loud rumble is nearly absent from the A-weighted total.
    expect(aWeightedDb(oneBand(0, 70))!).toBeCloseTo(70 - 56.7, 6);
    // 2.5 kHz is where the curve goes above unity.
    expect(aWeightedDb(oneBand(22, 70))!).toBeCloseTo(71.3, 6);
  });

  it('sums the bands rather than averaging them', () => {
    // Two equal 1 kHz-region bands are 3 dB more together, not the same number: bands are
    // parts of one signal, so their energies add.
    const bands = new Array<number | null>(CAL_BAND_COUNT).fill(null);
    bands[18] = 70;
    bands[17] = 70 + 0.8; // 800 Hz is −0.8 dB, so it lands at 70 weighted too
    expect(aWeightedDb(bands)!).toBeCloseTo(73.01, 2);
  });

  it('is null where nothing was measured', () => {
    expect(aWeightedDb(new Array(CAL_BAND_COUNT).fill(null))).toBeNull();
  });
});

describe("a run's LAeq pair", () => {
  it("averages the monitor's reported level over power", () => {
    const run = settled();
    run.add(flat(0), flat(0), 60);
    run.add(flat(0), flat(0), 70);
    // 67.4, for the reason the bands are — not 65. Same rule, separate accumulator.
    expect(run.result().laeq.device!).toBeCloseTo(67.4, 1);
  });

  it("takes the reference side off the same second's spectrum", () => {
    const run = settled();
    const bands = new Array<number | null>(CAL_BAND_COUNT).fill(null);
    bands[18] = 80;
    run.add(flat(0), bands, 84);
    const {laeq} = run.result();
    expect(laeq.reference!).toBeCloseTo(80, 6);
    expect(laeq.device!).toBeCloseTo(84, 6);
    // Same sign convention as the bands: positive means the monitor reads high.
    expect(laeq.difference!).toBeCloseTo(4, 6);
  });

  it('reports no LAeq where the monitor sent none', () => {
    const run = settled();
    run.add(flat(70), flat(70), null);
    const {laeq} = run.result();
    expect(laeq.device).toBeNull();
    // The reference side still has one — it is computed here, not reported — but a difference
    // needs both, so it stays null rather than standing in for one.
    expect(laeq.reference).not.toBeNull();
    expect(laeq.difference).toBeNull();
  });

  it('counts the two sides separately', () => {
    // A second with a spectrum but no LAeq must not drag the monitor's average toward the
    // reference's count, which is what one shared counter would do.
    const run = settled();
    run.add(flat(70), flat(70), 90);
    run.add(flat(70), flat(70), null);
    expect(run.result().laeq.device!).toBeCloseTo(90, 6);
  });
});
