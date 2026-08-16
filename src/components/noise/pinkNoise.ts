// Pink noise to play out of this computer, so the monitor and the reference microphone can
// be pointed at the same broadband signal instead of at whatever the room happens to be
// doing. Generated here rather than shipped as a file: an audio asset would be a megabyte in
// the bundle to say something that is thirty lines of arithmetic, and a lossily compressed
// one would not even say it — the whole value of this signal is its spectrum, which is the
// first thing a codec spends.
//
// React-free and DOM-free like referenceMic.ts, and for the same reason: the part that has
// to be right is the spectrum, and pinkNoise.test.ts measures it by transform rather than
// taking the filter's word for it. The hook does the AudioBuffer and the node.

// How long the generated loop is. Long enough that its period (0.125 Hz) is far below
// anything measured, so a one-second Leq sees an ordinary stretch of noise rather than the
// same stretch each time; short enough to stay a couple of megabytes of Float32 and a few
// milliseconds to make. It is looped rather than synthesised continuously because a loop
// needs no AudioWorklet, and with the seam handled below there is nothing to hear in the
// difference.
export const PINK_NOISE_SECONDS = 8;

// The samples spent joining the end of the loop back to its beginning — see the crossfade at
// the bottom. About 85 ms at 48 kHz: long enough that the two halves are mixed over many
// periods of even the lowest band, and 1 % of the loop, so it is not a meaningful part of
// what anybody measures.
const CROSSFADE_SAMPLES = 4096;

// Thrown away before the loop starts. The slowest pole below has a time constant of ~880
// samples, so a filter starting from silence spends about that long climbing to its working
// amplitude — keep those samples and the loop begins with a swell that is not noise.
const WARMUP_SAMPLES = 8192;

/**
 * Paul Kellett's pink filter: six one-pole sections and a direct path across white noise,
 * which together track −3 dB per octave to within about ±0.05 dB from ~10 Hz up.
 *
 * Chosen over the other usual answer, Voss-McCartney, because Voss builds its spectrum out
 * of a handful of white sources updated at halving rates and so is only pink in staircases,
 * with visible ripple at the octave boundaries — which are exactly the boundaries this
 * section measures on (see BAND_FREQUENCIES). The coefficients are empirical: they are a fit
 * to a −3 dB/octave line and not derived from anything, which is why the test measures the
 * slope with a transform rather than checking these numbers.
 *
 * Kept as a closure over its own state so a caller can generate one continuous stream in
 * pieces — the crossfade below needs the tail and the head to be the same stream.
 */
function pinkFilter(rand: () => number): () => number {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  return () => {
    // White, and two-sided: rand() is [0, 1), so this is [−1, 1) — a mean of zero, because
    // any offset here is a DC term the filter's slowest pole would smear into the lowest
    // bands rather than remove.
    const white = rand() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    return out;
  };
}

/**
 * One loop of pink noise, normalised to full scale.
 *
 * Two things are done to it, and both are about it being a *loop*:
 *
 * The end is crossfaded into the beginning, so playing it end to end has no discontinuity.
 * Without that, every pass around the buffer steps from the last sample to the first one and
 * that step is an impulse — broadband by definition, i.e. energy spread over exactly the
 * bands being read, arriving on a schedule that makes it look like a property of the room.
 * The mix is sin/cos rather than linear because the two stretches are independent noise:
 * uncorrelated signals add in power, so weights whose *squares* sum to one are what keeps
 * the level flat through the join.
 *
 * Then the whole thing is scaled so its loudest sample is exactly 1. This is what "maximum
 * volume" means for a signal like this — the peak is the only ceiling there is, and pink
 * noise sits some 12 dB below it in rms, which is not headroom being wasted but what a
 * crest factor of a random signal is. Normalising also removes the one weakness of the
 * filter above, whose gain is empirical and whose worst-case output is not bounded by
 * anything: measuring the peak and dividing is a guarantee where a fixed scale factor
 * would be a hope.
 */
export function pinkNoiseLoop(
  length: number,
  rand: () => number = Math.random,
): Float32Array<ArrayBuffer> {
  const fade = Math.min(CROSSFADE_SAMPLES, Math.floor(length / 2));
  const next = pinkFilter(rand);
  for (let i = 0; i < WARMUP_SAMPLES; i++) next();

  // Over an ArrayBuffer spelled out, rather than `new Float32Array(length)`, only so the type
  // is the non-shared one copyToChannel insists on — same reason as the analyser's buffer in
  // useReferenceMic.
  const out = new Float32Array(
    new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT),
  );
  for (let i = 0; i < length; i++) out[i] = next();

  // Where the stream carries on past the end of the buffer, folded back over the beginning
  // under weights that start at nothing. So the sample that follows out[length − 1] on the
  // next pass is exactly what the filter produced after it, and the two either side of the
  // seam are neighbours in one continuous stream — which is the whole point.
  for (let i = 0; i < fade; i++) {
    const theta = (Math.PI / 2) * (i / fade);
    out[i] = out[i]! * Math.sin(theta) + next() * Math.cos(theta);
  }

  let peak = 0;
  for (let i = 0; i < length; i++) {
    const a = Math.abs(out[i]!);
    if (a > peak) peak = a;
  }
  // A peak of zero means a rand() that only ever returned 0.5. Nothing to scale, and
  // dividing would hand the caller a buffer of NaN instead of a buffer of silence.
  if (peak > 0) {
    const scale = 1 / peak;
    for (let i = 0; i < length; i++) out[i] = out[i]! * scale;
  }
  return out;
}
