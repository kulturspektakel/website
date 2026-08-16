import {CAL_BAND_COUNT} from './bluetooth';
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
// Three is enough for both instruments: the monitor's fast window is 125 ms and its records
// arrive at 1 Hz, and the microphone's average is bounded by the same tick that feeds this. It
// is short enough that nobody watching the progress bar wonders whether it is stuck.
export const CALIBRATION_SAMPLES = 30;
export const SETTLE_SAMPLES = 3;
// What the progress bar counts, and what a full run costs in usable seconds.
export const CALIBRATION_SECONDS = SETTLE_SAMPLES + CALIBRATION_SAMPLES;

// One second of one instrument: 31 bands, null where it had nothing to report. Both sides
// arrive in this shape — the monitor's from decodeDb over its record, the microphone's from
// bandDb — which is what lets one accumulator take either.
export type BandReading = ReadonlyArray<number | null>;

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
  // How many seconds are in it, settle seconds excluded.
  samples: number;
};

export type CalibrationRun = {
  /**
   * Take one second of both instruments. The first SETTLE_SAMPLES calls are counted and
   * otherwise ignored — one place decides what is discarded, rather than every caller
   * remembering to.
   */
  add: (device: BandReading, reference: BandReading) => void;
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
    add: (device, reference) => {
      seconds++;
      if (seconds <= SETTLE_SAMPLES) return;
      accumulate(device, deviceSum, deviceCount);
      accumulate(reference, refSum, refCount);
      samples++;
    },
    seconds: () => seconds,
    samples: () => samples,
    result: () => {
      const device = meanDb(deviceSum, deviceCount);
      const reference = meanDb(refSum, refCount);
      return {
        device,
        reference,
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
