import {BAND_FREQUENCIES, CAL_BAND_COUNT} from './bluetooth';
import {fromEnergy, toEnergy, usableDb} from './leq';

// Reading a spectrum off a microphone attached to this computer, in the terms the monitor
// reports its own in. React-free and DOM-free, like noise.ts and for the same reason: what
// has to be right belongs somewhere a test can reach it. Two thirds of the file is
// arithmetic; the last third (see "Enumerating inputs") is which inputs to offer and what
// to call them, which is policy rather than DSP but just as testable without a browser.
//
// Energy and decibels go through leq.ts. There is one spelling of what a Leq is in this
// section and it lives there — see its own note on the subject.
//
// The whole file exists to make one comparison meaningful. The monitor computes its bands
// on-device (see the firmware's audio_dsp.c) and the browser computes the reference's from
// an AnalyserNode, and two spectra are only comparable if both are the same estimator of
// the same quantity. So the estimator below is not "a correct one" — it is deliberately
// the firmware's, down to which FFT bins each band is made of.

/**
 * Whether this browser can capture audio at all.
 *
 * Named and kept here rather than inlined in the hook's effect, so it reads beside
 * isWebBluetoothSupported and can be reasoned about without a browser — the hook's job is
 * to call it in an effect (never during render, which the server also runs).
 */
export const isMicCaptureSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  navigator.mediaDevices?.getUserMedia != null &&
  typeof AudioContext !== 'undefined';

// --- The firmware's grid ------------------------------------------------------------

// What the monitor runs at. Mirrored here rather than inferred, because these two numbers
// decide the bin edges below, and a browser reading the same room through a different grid
// would disagree with the monitor about the low bands for reasons that have nothing to do
// with either microphone.
export const DEVICE_SAMPLE_RATE = 48000;
export const DEVICE_FFT_SIZE = 4096;

// 2^(1/6) — a third-octave band runs from its centre divided by this to its centre times
// it, which is the whole of the band definition the firmware uses.
const SIXTH_OCTAVE = 2 ** (1 / 6);

export type BandBin = {
  // Inclusive first bin, exclusive last — a half-open range, as the firmware's
  // `for (k = start; k < end; k++)` reads it.
  start: number;
  end: number;
};

/**
 * Which FFT bins each of the 31 bands is summed from, exactly as `compute_band_edges()`
 * decides it on the device.
 *
 * Two details here are load-bearing rather than incidental, and both are why this is a
 * function with a test rather than four lines inlined at the call site:
 *
 * Bands are defined by their *lower* edges only — band i ends where band i+1 begins — so
 * they tile the spectrum contiguously with no gap and no overlap, and no band's upper edge
 * is ever computed. Only the last one's is, because it has no successor.
 *
 * And the bottom of the range is degenerate at this resolution. At 48 kHz over 4096 points
 * a bin is 11.72 Hz wide, while the 16 Hz band is 3.7 Hz wide: rounding sends 20, 25 *and*
 * 31.5 Hz to the same bin, and the firmware's "a band is at least one bin" rule then makes
 * all three report the same number. That is a property of the instrument we are measuring,
 * so we reproduce it rather than fix it — a browser that resolved those bands properly
 * would show three differences that are really one artefact.
 */
export function bandBins(
  sampleRate: number,
  fftSize: number,
): readonly BandBin[] {
  const binHz = sampleRate / fftSize;
  const nyquistBin = fftSize / 2;
  // Bin 0 is DC and never belongs to a band; the firmware clamps up to 1 for the same
  // reason, and a soundcard's DC offset is exactly what that clamp keeps out.
  const lowerBin = (hz: number) =>
    Math.min(nyquistBin, Math.max(1, Math.round(hz / binHz)));

  const starts = BAND_FREQUENCIES.map((hz) => lowerBin(hz / SIXTH_OCTAVE));
  // The one upper edge that has to be computed, the top band's, since there is no band
  // above it to borrow a lower edge from.
  const top = Math.min(
    nyquistBin,
    Math.round((BAND_FREQUENCIES[CAL_BAND_COUNT - 1]! * SIXTH_OCTAVE) / binHz),
  );

  return starts.map((start, i) => {
    const next = starts[i + 1] ?? top;
    // A band that rounded to nothing still gets its one bin — and then that bin still has
    // to exist, which it does not for a band sitting on Nyquist (only reachable below
    // ~36 kHz sampling). Such a band comes out empty and reads as no data, which is the
    // honest answer: nothing was measured there.
    const end = Math.min(nyquistBin, Math.max(next, start + 1));
    return {start, end: Math.max(start, end)};
  });
}

// --- From an AnalyserNode's output to dB SPL -----------------------------------------

// Σw²/N for the window the Web Audio spec applies before every transform: a *periodic*
// Blackman (α = 0.16, and the cosine denominator is N rather than N−1, which is what makes
// it periodic). The cross terms of the expansion integrate to exactly zero over a whole
// period, so the closed form below is exact rather than an approximation — and
// referenceMic.test.ts checks it against the numeric sum, because the symmetric N−1
// spelling of the same window would quietly break that.
const BLACKMAN_A0 = 0.42;
const BLACKMAN_A1 = 0.5;
const BLACKMAN_A2 = 0.08;
export const MEAN_W2_BLACKMAN =
  BLACKMAN_A0 ** 2 + BLACKMAN_A1 ** 2 / 2 + BLACKMAN_A2 ** 2 / 2;

/** The spec's periodic Blackman, for the test that pins MEAN_W2_BLACKMAN. */
export const blackmanWindow = (n: number, size: number): number =>
  BLACKMAN_A0 -
  BLACKMAN_A1 * Math.cos((2 * Math.PI * n) / size) +
  BLACKMAN_A2 * Math.cos((4 * Math.PI * n) / size);

// The dBFS reference convention, and the reason it is a named constant instead of a magic
// 3.01: "0 dBFS" in audio means the loudest *undistorted sine*, whose peak is 1 and whose
// RMS is therefore 1/√2. On a scale where 0 dB means an RMS of 1, that sine measures
// 10·log10(0.5) = −3.01 dB, so this is what puts it back at 0.
//
// It matters only because microphone sensitivities are quoted against that convention —
// the monitor's INMP441 is "−26 dBFS at 94 dB SPL", i.e. 0 dBFS = 120 dB SPL, which is
// where the firmware's MIC_DBFS_TO_SPL_DB comes from. Leave this out and every level here
// is 3 dB low. The firmware writes the same term as `10log10(2)` inside its energy anchor;
// its `3N²/16` denominator already carries the one-sided fold, so that `10log10(2)` is
// this crest factor and not a second fold. Counting it twice is the easy mistake.
const FULL_SCALE_SINE_DB = 10 * Math.log10(2);

/**
 * Add one AnalyserNode frame's per-band energy into a running total.
 *
 * `getFloatFrequencyData` hands back 20·log10(|X[k]|/fftSize) per the spec, so a bin's
 * energy is (|X[k]|/N)² — a normalised power, which is what makes the sum
 * Parseval-normalisable in bandDb. Bins the browser reported as −Infinity (a silent frame,
 * or a suspended context) contribute nothing rather than poisoning the sum.
 *
 * Adds rather than returns, so that the ~22 frames a second this is called at allocate
 * nothing: the accumulator below hands it the same array every time.
 */
export function addBandPower(
  freqDb: Float32Array,
  bins: readonly BandBin[],
  into: Float64Array,
): void {
  for (let b = 0; b < bins.length; b++) {
    const {start, end} = bins[b]!;
    let sum = 0;
    for (let k = start; k < end; k++) {
      const db = freqDb[k];
      if (!usableDb(db)) continue;
      sum += toEnergy(db);
    }
    into[b]! += sum;
  }
}

/** One frame's per-band energy on its own, for the tests and for reading in isolation. */
export const bandPower = (
  freqDb: Float32Array,
  bins: readonly BandBin[],
): Float64Array => {
  const out = new Float64Array(bins.length);
  addBandPower(freqDb, bins, out);
  return out;
};

export type BandAccumulator = {
  accumulate: (freqDb: Float32Array) => void;
  /**
   * The mean power per band since the last drain, and a reset. Null when no frame arrived
   * at all — a backgrounded tab stops delivering them, and "no measurement" has to be
   * distinguishable from "silence" all the way up to the chart.
   */
  drain: () => Float64Array | null;
};

/**
 * One second's worth of frames, energetically averaged.
 *
 * The mean is over linear power and not over decibels, which is the same reason
 * leq.ts averages the way it does — and it is also what the firmware does between its
 * ~23 FFTs per second. The frame count is not fixed here: an unbiased mean does not need
 * it to be, so an interval that drifts or a frame the browser skipped costs variance
 * rather than accuracy.
 */
export function createBandAccumulator(
  bins: readonly BandBin[],
): BandAccumulator {
  const sums = new Float64Array(bins.length);
  let frames = 0;

  return {
    accumulate: (freqDb) => {
      addBandPower(freqDb, bins, sums);
      frames++;
    },
    drain: () => {
      if (frames === 0) return null;
      const mean = new Float64Array(sums.length);
      for (let b = 0; b < sums.length; b++) mean[b] = sums[b]! / frames;
      sums.fill(0);
      frames = 0;
      return mean;
    },
  };
}

/**
 * A band's mean power, as dB SPL.
 *
 *   dB = 10·log10(2 · Σp / meanW2) + FULL_SCALE_SINE_DB + sensitivityDb + correction
 *
 * The 2 is the one-sided fold (an AnalyserNode reports only the positive half of a
 * Hermitian spectrum) and dividing by Σw²/N is Parseval: together they turn a windowed
 * bin sum back into the signal's mean square in full-scale units. That normalisation is
 * what makes the result window-independent, which is why a Blackman here can be compared
 * with the firmware's Hann at all.
 *
 * A band with no energy comes back null rather than −Infinity, so a silent band reads as
 * a gap everywhere downstream instead of drawing a line to the floor of the chart.
 */
export function bandDb(
  meanPower: Float64Array,
  {
    sensitivityDb,
    correction,
  }: {
    // The dB SPL that drives this input to full scale — the microphone's sensitivity, and
    // the one number in here that cannot be derived from anything the browser knows.
    sensitivityDb: number;
    // Per-band dB to add, from the reference microphone's own response file. One entry per
    // band, zeroes where there is no file — see refCorrectionBands, which always returns a
    // full set, so this needs no per-index fallback.
    correction?: readonly number[];
  },
): (number | null)[] {
  return Array.from(meanPower, (p, i) => {
    if (!(p > 0) || !Number.isFinite(p)) return null;
    return (
      fromEnergy((2 * p) / MEAN_W2_BLACKMAN) +
      FULL_SCALE_SINE_DB +
      sensitivityDb +
      (correction?.[i] ?? 0)
    );
  });
}

// --- The reference microphone's own response ------------------------------------------

// A calibration file as it ships: frequency in Hz against how far this unit's sensitivity
// deviates from flat there, ascending by frequency.
export type CalCurve = ReadonlyArray<readonly [hz: number, db: number]>;

/**
 * The file's deviation at one frequency, interpolated on log frequency because that is the
 * axis it was measured on — a linear interpolation between 20 Hz and 25 Hz points is a
 * different curve depending on which of the two you start from otherwise.
 *
 * Held flat outside the file's range rather than extrapolated: a cal file stops where the
 * measurement stopped, and inventing a slope past that end is inventing data at exactly
 * the frequencies where a microphone is least predictable.
 */
export function interpolateCal(cal: CalCurve, hz: number): number {
  if (cal.length === 0) return 0;
  if (hz <= cal[0]![0]) return cal[0]![1];
  const last = cal[cal.length - 1]!;
  if (hz >= last[0]) return last[1];

  for (let i = 1; i < cal.length; i++) {
    const [hiHz, hiDb] = cal[i]!;
    if (hz > hiHz) continue;
    const [loHz, loDb] = cal[i - 1]!;
    const t =
      (Math.log(hz) - Math.log(loHz)) / (Math.log(hiHz) - Math.log(loHz));
    return loDb + t * (hiDb - loDb);
  }
  return last[1];
}

/**
 * The cal curve as 31 corrections to *add* to the measured band levels.
 *
 * Negated on the way through, which is the whole subtlety: the file says how much this
 * unit over-reports at each frequency, so undoing it means subtracting. Getting the sign
 * backwards doubles the error instead of removing it, and the result still looks
 * plausible — hence a named function rather than a minus sign at the call site.
 */
export const refCorrectionBands = (cal: CalCurve): number[] =>
  BAND_FREQUENCIES.map((hz) => -interpolateCal(cal, hz));

export type ReferenceMic = {
  // Matched against a substring of the browser's label for the input, because that label
  // is all we get to identify hardware by — device ids are per-origin and rotate.
  match: string;
  name: string;
  /**
   * The dB SPL that this model's cal-file `Sens Factor` is quoted at, which is the whole of
   * what turns that one header line into a sensitivity — and so what lets a dropped file
   * calibrate the level with nothing asked of anybody. A model whose convention we have not
   * pinned down has no row here at all rather than a row with nothing in it, so this is
   * never absent; an unrecognised input falls back to NOMINAL_SENSITIVITY_DB instead.
   *
   * For the UMIK-1 this is 100 dB, and the reasoning is worth keeping because the public
   * documentation on it disagrees with itself. REW's author describes the figure as the
   * microphone's rms level in dBFS under a *94 dB* calibrator at maximum input volume,
   * counting a full-scale sine as −3.01 dBFS. But real files carry fractions of a dB — this
   * unit's is +0.3156 — and 0.3 dB *above* full scale at 94 dB SPL is a microphone that
   * clips below the level it is being calibrated at. The reading that makes the numbers
   * cohere is the other one in circulation: the figure is the dBFS reading for **100 dB
   * SPL** with the input volume at 100 %, which for this microphone is 24 dB of digital
   * gain, and the internal analog gain is already folded into it.
   *
   * So it is an inference from arithmetic rather than a documented constant, and it is
   * checkable in a minute: derive the sensitivity, play a steady tone, and compare with REW
   * or a calibrator. Agreement confirms it. Being out by exactly 6 dB says the 94 dB
   * reading was right after all, and this becomes 94.
   *
   * Two things it depends on either way. The system input volume must be at maximum, which
   * is the position the figure is defined at and one no browser can read — and note that at
   * maximum this microphone clips somewhere near 100 dB SPL, so it is the wrong setting for
   * measuring a loud stage and the right one for calibrating against a monitor indoors. And
   * the analog gain is part of the identity: macOS names the device `Umik-1  Gain: 18dB`,
   * and a unit switched to 0 dB reads 18 dB differently, which is why `match` spells the
   * gain out rather than matching the model alone.
   */
  calReferenceDb: number;
};

// The microphones whose calibration files we know how to read a level out of. A model earns
// a row by having its Sens Factor convention pinned down; everything else can still be
// plotted, but only as a shape.
export const REFERENCE_MICS: readonly ReferenceMic[] = [
  {
    // Verbatim as CoreAudio reports it (`system_profiler SPAudioDataType`), double space and
    // lower-case "mik" included, so that what is written here can be compared with what the
    // machine says. Matching is loose about case and runs of whitespace all the same — see
    // referenceMicFor — because this string reaches us through the browser, which is one
    // more layer that could tidy it.
    //
    // The gain is part of the match and not decoration: the same capsule at 0 dB is a
    // different instrument as far as the level is concerned, so a unit reporting another
    // gain deliberately fails to match. Better unrecognised than silently 18 dB out.
    //
    // Which does mean this one string carries two facts — the model, whose convention sets
    // calReferenceDb, and this unit's analog gain. A second gain therefore wants a `gainDb`
    // field and a sensitivity that accounts for it, not a second row repeating `name` and
    // `calReferenceDb`. Left folded until a microphone exists that needs it.
    match: 'Umik-1  Gain: 18dB',
    name: 'miniDSP UMIK-1',
    calReferenceDb: 100,
  },
];

/**
 * The sensitivity a calibration file implies: the dB SPL that drives this unit to full
 * scale, from the one number in its header.
 *
 * This is what makes a dropped file enough on its own. A `Sens Factor` is the unit's rms
 * level in dBFS at `calReferenceDb`, counting a full-scale sine as −3.01 dBFS rather than 0
 * — so undoing that convention and taking the difference from the reference level is the
 * whole conversion. A more sensitive unit has a higher Sens Factor and therefore reaches
 * full scale at a *lower* SPL, which is why it subtracts.
 */
export const sensitivityFromSensFactor = (
  sensFactorDb: number,
  calReferenceDb: number,
): number => calReferenceDb - FULL_SCALE_SINE_DB - sensFactorDb;

// Case and runs of whitespace folded away before comparing. A device name reaches us
// through CoreAudio and then through the browser, and either may present it slightly
// differently — the UMIK-1's own name carries a double space, which is exactly the kind of
// thing to survive one layer and not the next. Nothing that distinguishes two microphones
// lives in that difference, so none of it is worth failing a match over.
const normaliseLabel = (s: string) =>
  s.toLowerCase().replace(/\s+/g, ' ').trim();

export const referenceMicFor = (
  label: string | null | undefined,
): ReferenceMic | undefined =>
  label == null
    ? undefined
    : REFERENCE_MICS.find((m) =>
        normaliseLabel(label).includes(normaliseLabel(m.match)),
      );

// Where an input with no established sensitivity is plotted. Arbitrary, and it has to be
// something: at a true 0 the line would sit 100 dB below the chart's floor and read as a
// feature that does not work. The monitor's own anchor is the least surprising choice, and
// everything that shows this level says it is uncalibrated.
export const NOMINAL_SENSITIVITY_DB = 120;

// --- Enumerating inputs ---------------------------------------------------------------

// The shape of a MediaDeviceInfo, structurally, so the helpers below are callable from a
// test without a DOM.
type InputInfo = {
  kind: string;
  deviceId: string;
  label: string;
};

export type AudioInputOption = {deviceId: string; label: string};

// Chrome's two aliases for "whatever the system picked". They point at a real device that
// is also listed under its own id, so keeping them would offer the same microphone three
// times — and picking one of them means the selection silently follows the system default.
const PSEUDO_IDS = new Set(['default', 'communications']);

/**
 * The inputs worth offering, named.
 *
 * A label can be empty even when the id is not (an input the browser knows about but has
 * no name for), so the fallback numbers them in list order rather than dropping them.
 *
 * The selected one is always in the result, even after it has been unplugged: a picker
 * whose current value is missing from its own list reads as a picker showing nothing.
 */
export function audioInputOptions(
  devices: readonly InputInfo[],
  selected: AudioInputOption | null,
): AudioInputOption[] {
  const options: AudioInputOption[] = [];
  for (const d of devices) {
    if (d.kind !== 'audioinput') continue;
    // Both the id and the label are the empty string until this document has captured
    // once: enumerateDevices() needs no permission, but what it will *say* is gated on a
    // getUserMedia call in this document having resolved — which is why the panel asks for
    // the microphone before it opens, and never lists anything before that. Note the gate
    // is that capture and not the permission, which may well be granted and stored from an
    // earlier visit. An empty id is dropped rather than offered, since
    // `{deviceId: {exact: ''}}` is a constraint that can never match.
    if (d.deviceId === '' || PSEUDO_IDS.has(d.deviceId)) continue;
    options.push({
      deviceId: d.deviceId,
      label: d.label || `Mikrofon ${options.length + 1}`,
    });
  }
  if (selected && !options.some((o) => o.deviceId === selected.deviceId)) {
    options.push(selected);
  }
  return options;
}

// The three we ask to be turned off, and what to call them when they weren't. Automatic
// gain is the one that makes a comparison meaningless rather than merely offset — it moves
// the level while we are measuring it — but noise suppression and echo cancellation both
// reshape the spectrum, which is exactly what we are here to read.
const PROCESSING_LABELS = {
  autoGainControl: 'Automatische Verstärkung',
  noiseSuppression: 'Rauschunterdrückung',
  echoCancellation: 'Echounterdrückung',
} as const;

type ProcessingSettings = {
  // Not just booleans: a browser may report one of these as a mode instead — Chrome
  // answers echoCancellation with a named type — which is why this mirrors the DOM's own
  // `string | boolean` rather than narrowing it away.
  [K in keyof typeof PROCESSING_LABELS]?: boolean | string;
};

// Whether a reported setting says the processing is happening.
//
// `undefined` is "no answer" and not "off". Safari reports two of these not at all, so
// testing `!== false` would warn every Safari user about processing that may not be
// happening — and a warning that fires when nothing is wrong is one nobody reads when
// something is.
//
// A named mode counts as on unless it names the absence of one, which is the only reading
// that fails safe: an unrecognised mode is more likely to be some kind of processing than
// to be none, and the cost of being wrong is a warning rather than a silent bad number.
const processingOn = (value: boolean | string | undefined): boolean =>
  value === true ||
  (typeof value === 'string' && value !== '' && value !== 'none' && value !== 'off'); // prettier-ignore

/** Which of the three the browser kept on, out of what it will admit to. */
export const settingsWarnings = (settings: ProcessingSettings): string[] =>
  (Object.keys(PROCESSING_LABELS) as Array<keyof typeof PROCESSING_LABELS>)
    .filter((key) => processingOn(settings[key]))
    .map((key) => PROCESSING_LABELS[key]);
