import {
  BAND_FREQUENCIES,
  CAL_BAND_COUNT,
  CAL_MAX_DB,
  snapTrim,
} from './bluetooth';
import {fromEnergy, toEnergy, usableDb} from './leq';

// Measuring one monitor against the reference microphone: thirty seconds of both instruments
// reading the same room, averaged, and the per-band difference between the two averages.
//
// React-free and DOM-free like referenceMic.ts, for the same reason — what has to be right is
// the average, and it is the kind of thing that looks right whatever it does. The browser half
// (which second counts, when to stop, when to give up) is in useReferenceMic; what is here is
// only the accumulation.
//
// Why an average at all: the band chart's tooltip already shows this second's difference, and
// it moves several dB from second to second because a room does. That reading is an
// indication. A calibration figure has to be steadier than the thing it is measuring, which is
// what thirty seconds of pink noise and an energetic mean buy.

// How many seconds go into the average, and how many are thrown away before it starts.
//
// The settle window is not politeness. Everything begins at once when a run starts — the noise
// is switched on, the microphone's accumulator was drained by whatever tick started the run,
// and the monitor's own fast window is still averaging a room that was quiet a moment ago — so
// the first seconds are a recording of the level *arriving*. Averaged in, they drag every band
// down by however much of them was silence, and nothing about the result would look wrong.
//
// Five is enough for both instruments: the monitor's fast window is 125 ms and its records
// arrive at 1 Hz, and the microphone's average is bounded by the same tick that feeds this. It
// is short enough that nobody watching the progress bar wonders whether it is stuck.
export const CALIBRATION_SAMPLES = 30;
export const SETTLE_SAMPLES = 5;
// What the progress bar counts, and what a full run costs in usable seconds.
export const CALIBRATION_SECONDS = SETTLE_SAMPLES + CALIBRATION_SAMPLES;

// One second of one instrument: 31 bands, null where it had nothing to report. Both sides
// arrive in this shape — the monitor's from decodeDb over its record, the microphone's from
// bandDb — which is what lets one accumulator take either.
export type BandReading = ReadonlyArray<number | null>;

/**
 * A-weighting at the 31 nominal band centres, in dB, per IEC 61672-1.
 *
 * Here because the reference microphone has no A-weighted level of its own: it is a spectrum
 * and nothing else (see bandDb), while the monitor publishes an LAeq the whole section is
 * built around. Weighting the microphone's bands and summing them is what puts the two on
 * speaking terms.
 *
 * Standard figures rather than the analytic response they approximate, in band order to match
 * BAND_FREQUENCIES — and asserted against it below, since a table silently one short would
 * weight every band above the gap with its neighbour's figure.
 */
const A_WEIGHTING = [
  -56.7, -50.5, -44.7, -39.4, -34.6, -30.2, -26.2, -22.5, -19.1, -16.1, -13.4,
  -10.9, -8.6, -6.6, -4.8, -3.2, -1.9, -0.8, 0, 0.6, 1, 1.2, 1.3, 1.2, 1, 0.5,
  -0.1, -1.1, -2.5, -4.3, -6.6,
] as const;

if (A_WEIGHTING.length !== BAND_FREQUENCIES.length) {
  throw new Error('A_WEIGHTING must carry one figure per band');
}

/**
 * One second of a spectrum as a single A-weighted level: each band weighted and the lot
 * summed as energy.
 *
 * A sum and not a mean — unlike everything else in this file, which averages *over time*.
 * Bands are parts of one signal, so their energies add; averaging them would report a
 * spectrum's typical band rather than its level.
 *
 * Null where no band was usable at all. Bands that are individually absent are skipped
 * rather than counted as silence, which understates the total by however much they held —
 * acceptable because the alternative overstates it, and because A-weighting has already
 * discarded most of what the extreme bands (where absence is likeliest) contribute.
 */
export function aWeightedDb(bands: BandReading): number | null {
  let sum = 0;
  let n = 0;
  for (let b = 0; b < CAL_BAND_COUNT; b++) {
    const db = bands[b];
    if (!usableDb(db)) continue;
    sum += toEnergy(db + A_WEIGHTING[b]!);
    n++;
  }
  return n === 0 ? null : fromEnergy(sum);
}

export type CalibrationResult = {
  /**
   * The finding: how far the monitor is from the reference in each band, in dB.
   *
   * `device − reference`, so a positive number means the monitor reads *high* and would need
   * trimming down by that much. Stated here because the sign is the whole content — the
   * opposite convention is equally sayable and would send a correction the wrong way, doubling
   * an error that looked plausible either way.
   */
  difference: (number | null)[];
  // Both averages as well, because a difference on its own cannot be sanity-checked. A band
  // where the monitor is at its floor and the microphone hears nothing produces a difference
  // like any other; seeing the two levels says which case it is.
  device: (number | null)[];
  reference: (number | null)[];
  /**
   * The same comparison for the one number the section is otherwise built on, alongside the
   * bands it is made of.
   *
   * Worth its own place rather than being left implicit in the spectrum: a permit is written
   * against an LAeq, so whether *that* figure agrees with the reference is the question the
   * bands are only evidence for. The two sides are not arrived at the same way — the monitor's
   * is the LAeq it publishes, computed in its firmware from full-resolution A-weighted bins,
   * and the reference's is aWeightedDb over its 31 bands. That asymmetry is the point: it is
   * what makes this an end-to-end check of the number the monitor reports rather than a
   * restatement of the bars.
   */
  laeq: {
    device: number | null;
    reference: number | null;
    // `device − reference`, the same convention and the same sign as `difference` above.
    difference: number | null;
  };
  // How many seconds are in it, settle seconds excluded.
  samples: number;
};

export type CalibrationRun = {
  /**
   * Take one second of both instruments. The first SETTLE_SAMPLES calls are counted and
   * otherwise ignored — one place decides what is discarded, rather than every caller
   * remembering to.
   */
  add: (
    device: BandReading,
    reference: BandReading,
    // The monitor's own LAeq for this second, or null if it did not report one. The
    // reference's counterpart is not a parameter: it is read off `reference` here (see
    // aWeightedDb), so the two halves of the LAeq comparison cannot come from different
    // seconds.
    deviceLaeq: number | null,
  ) => void;
  // Usable seconds so far, settle ones included: what the progress bar is a fraction of.
  seconds: () => number;
  // Of those, how many are in the average. The run is finished when this reaches
  // CALIBRATION_SAMPLES.
  samples: () => number;
  result: () => CalibrationResult;
};

/**
 * A run in progress: energy per band per instrument, summed as the seconds arrive.
 *
 * Sums rather than a list of seconds, because nothing needs a second back once it has been
 * counted — and it keeps the run's cost fixed whatever its length.
 *
 * Counted per band rather than per second, on both sides. A band can be absent from a single
 * second on its own (the microphone reports null for a band no energy landed in — see bandDb),
 * and treating that as a zero would be treating "not measured" as silence, which is the one
 * mistake this section's arithmetic is most careful about everywhere else.
 */
export function createCalibrationRun(): CalibrationRun {
  const deviceSum = new Float64Array(CAL_BAND_COUNT);
  const deviceCount = new Float64Array(CAL_BAND_COUNT);
  const refSum = new Float64Array(CAL_BAND_COUNT);
  const refCount = new Float64Array(CAL_BAND_COUNT);
  // The LAeq pair, accumulated the same way and counted separately: a second can carry a
  // spectrum without an LAeq, or the reverse, and pairing them by count would silently average
  // a different number of seconds on each side.
  let laeqDeviceSum = 0;
  let laeqDeviceCount = 0;
  let laeqRefSum = 0;
  let laeqRefCount = 0;
  let seconds = 0;
  let samples = 0;

  const accumulate = (
    reading: BandReading,
    sum: Float64Array,
    count: Float64Array,
  ) => {
    for (let b = 0; b < CAL_BAND_COUNT; b++) {
      const db = reading[b];
      if (!usableDb(db)) continue;
      sum[b]! += toEnergy(db);
      count[b]! += 1;
    }
  };

  // The energetic mean, band by band — 10·log10(mean(10^(L/10))), which is what a Leq is in
  // this section (see leq.ts, which owns the definition and the three primitives above).
  const meanDb = (sum: Float64Array, count: Float64Array): (number | null)[] =>
    Array.from(sum, (s, b) =>
      count[b]! === 0 ? null : fromEnergy(s / count[b]!),
    );

  return {
    add: (device, reference, deviceLaeq) => {
      seconds++;
      if (seconds <= SETTLE_SAMPLES) return;
      accumulate(device, deviceSum, deviceCount);
      accumulate(reference, refSum, refCount);
      if (usableDb(deviceLaeq)) {
        laeqDeviceSum += toEnergy(deviceLaeq);
        laeqDeviceCount++;
      }
      const refLaeq = aWeightedDb(reference);
      if (usableDb(refLaeq)) {
        laeqRefSum += toEnergy(refLaeq);
        laeqRefCount++;
      }
      samples++;
    },
    seconds: () => seconds,
    samples: () => samples,
    result: () => {
      const device = meanDb(deviceSum, deviceCount);
      const reference = meanDb(refSum, refCount);
      // Each side averaged over its own seconds, for the reason the bands are: an energetic
      // mean of levels, not a mean of the per-second differences.
      const laeqDevice =
        laeqDeviceCount === 0
          ? null
          : fromEnergy(laeqDeviceSum / laeqDeviceCount);
      const laeqReference =
        laeqRefCount === 0 ? null : fromEnergy(laeqRefSum / laeqRefCount);
      return {
        device,
        reference,
        laeq: {
          device: laeqDevice,
          reference: laeqReference,
          difference:
            laeqDevice == null || laeqReference == null
              ? null
              : laeqDevice - laeqReference,
        },
        // Each instrument averaged first, and only then subtracted. Not a mean of the
        // per-second differences, which is a third quantity again: over a signal that moves it
        // weights a quiet second as heavily as a loud one, where what is wanted is the
        // difference between two levels each measured the way this section measures a level.
        difference: device.map((d, b) => {
          const r = reference[b];
          return d == null || r == null ? null : d - r;
        }),
        samples,
      };
    },
  };
}

/**
 * What to write to the monitor to make it agree with the reference: its current trims,
 * corrected by a run's finding.
 *
 * A read-modify-write and not a bare write of the difference, because the difference was
 * measured *through* the trims already in force — the device transmits levels with its own
 * calibration applied (see decodeDb in noise.ts, which is the whole decode and has no
 * calibration term in it), so a run against a monitor already trimmed by 2 dB measures the
 * trimmed monitor.
 *
 * The sign, which is the only thing in here that can be wrong in a way nothing looks wrong:
 *
 *     reported   = raw + current            firmware adds the stored offset
 *     difference = reported − reference     this file's convention, above
 *     wanted:      raw + next == reference
 *     so           next = current − difference
 *
 * That the firmware *adds* is the load-bearing half, and it is not this repo's to assert:
 * see main/audio_dsp.c in kulturspektakel/noisemonitor, where the per-band correction is
 * declared "added in dB-space; positive = this band reads low, push it up", turned into a
 * linear power multiplier, and applied to the band sum. Backwards, this function would
 * double every error it was asked to fix, and a second run would confirm it beautifully.
 */
export function trimsForResult(
  current: number[],
  difference: ReadonlyArray<number | null>,
): number[] {
  return wantedTrims(current, difference).map(snapTrim);
}

/**
 * The correction the run asks for, before the wire's step and range are imposed on it.
 *
 * Separate from `trimsForResult` only so that the subtraction above — the sign, and what a
 * band nobody measured does — has one implementation rather than one per question asked of
 * it. `railedBands` is the second question.
 */
function wantedTrims(
  current: number[],
  difference: ReadonlyArray<number | null>,
): number[] {
  return Array.from({length: CAL_BAND_COUNT}, (_, b) => {
    const held = current[b] ?? 0;
    const d = difference[b];
    // A band nothing landed in keeps whatever trim it has. Zeroing it would discard a good
    // trim on the strength of having learned nothing about it, and leaving it out would
    // shift every band above it onto the wrong frequency.
    return d == null ? held : held - d;
  });
}

/**
 * How many bands `trimsForResult` had to cut short, because the correction they asked for is
 * further than a trim can go.
 *
 * Not a detail of the writing: a band at the rail is one the monitor will still disagree with
 * the reference about afterwards, so a second run shows daylight in it and, unsaid, that reads
 * as the write having failed. Which bands is not asked, only how many — the chart shows where.
 */
export function railedBands(
  current: number[],
  difference: ReadonlyArray<number | null>,
): number {
  return wantedTrims(current, difference).filter(
    (wanted) => Math.abs(wanted) > CAL_MAX_DB,
  ).length;
}
