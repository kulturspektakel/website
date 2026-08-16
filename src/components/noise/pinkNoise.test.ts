import {describe, expect, it} from 'vitest';
import {DEVICE_SAMPLE_RATE} from './referenceMic';
import {PINK_NOISE_SECONDS, pinkNoiseLoop} from './pinkNoise';

// A seeded generator, so every assertion below is about the filter rather than about the luck
// of one run. mulberry32, chosen for being four lines — nothing here needs a good PRNG, only
// a repeatable one.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The buffer the browser would actually be handed, at the rate it would be made for.
const LOOP = pinkNoiseLoop(DEVICE_SAMPLE_RATE * PINK_NOISE_SECONDS, seeded(1));

const SIZE = 4096;
const HANN = Array.from(
  {length: SIZE},
  (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / SIZE),
);

/**
 * The signal's power in one FFT bin, measured rather than assumed — Goertzel, Hann windowed,
 * averaged over every whole block in the buffer.
 *
 * Nothing from pinkNoise.ts takes part in this, which is the point: the coefficients over
 * there are an empirical fit to a −3 dB/octave line, so the only thing that can confirm they
 * still are is a transform of the output.
 */
function binPower(samples: Float32Array, bin: number): number {
  const blocks = Math.floor(samples.length / SIZE);
  const coeff = 2 * Math.cos((2 * Math.PI * bin) / SIZE);
  let total = 0;
  for (let b = 0; b < blocks; b++) {
    let s1 = 0;
    let s2 = 0;
    for (let n = 0; n < SIZE; n++) {
      const s0 = samples[b * SIZE + n]! * HANN[n]! + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    total += (s1 * s1 + s2 * s2 - coeff * s1 * s2) / (SIZE * SIZE);
  }
  return total / blocks;
}

// Eight bins spread over an octave, at fixed ratios to its centre. Averaging over them is
// what makes the comparison between octaves an estimate of the *slope* rather than of one
// bin's luck: a single bin of a random signal is an exponentially distributed estimate of its
// power, and 1/f noise wanders on every timescale besides.
const SPOTS = Array.from({length: 8}, (_, j) => 2 ** (j / 8 - 0.5));

const octaveDb = (samples: Float32Array, centreBin: number): number =>
  10 *
  Math.log10(
    SPOTS.reduce(
      (sum, f) =>
        sum + binPower(samples, Math.max(1, Math.round(centreBin * f))),
      0,
    ) / SPOTS.length,
  );

// Six octaves at 4096 points and 48 kHz: 187 Hz to 12 kHz. Below that an octave is too few
// bins wide to average over, and above it there is nothing this section measures.
const CENTRE_BINS = [16, 32, 64, 128, 256, 512, 1024];

describe('pinkNoiseLoop', () => {
  it('falls 3 dB per octave', () => {
    const db = CENTRE_BINS.map((bin) => octaveDb(LOOP, bin));

    // The whole span at once, which is the tight assertion: −3.01 dB is what "pink" means —
    // equal power in every octave band, and so half the power per bin each time the bins are
    // twice as far apart.
    const perOctave = (db[db.length - 1]! - db[0]!) / (db.length - 1);
    expect(perOctave).toBeGreaterThan(-3.4);
    expect(perOctave).toBeLessThan(-2.7);

    // And octave by octave, loosely, because each of these is one estimate rather than an
    // average of six. This is here to catch a filter that has the right slope overall and a
    // step in the middle of it.
    for (let i = 1; i < db.length; i++) {
      expect(db[i]! - db[i - 1]!).toBeGreaterThan(-4.2);
      expect(db[i]! - db[i - 1]!).toBeLessThan(-1.8);
    }
  });

  it('uses the whole of full scale and none beyond it', () => {
    let peak = 0;
    for (const x of LOOP) peak = Math.max(peak, Math.abs(x));
    // Exactly 1, because the buffer is divided by its own peak: under it is level given away
    // for nothing, over it is samples the sound card would clip.
    expect(peak).toBeCloseTo(1, 6);
  });

  it('joins its own end without a step', () => {
    // What an ordinary sample-to-sample step is in this signal, so the seam can be compared
    // with its neighbours instead of with zero.
    let sumSq = 0;
    for (let i = 1; i < LOOP.length; i++)
      sumSq += (LOOP[i]! - LOOP[i - 1]!) ** 2;
    const rmsStep = Math.sqrt(sumSq / LOOP.length);

    const seam = Math.abs(LOOP[0]! - LOOP[LOOP.length - 1]!);
    // Unremarkable, i.e. of a size that occurs inside the buffer constantly. Without the
    // crossfade this would be the gap between two independent samples — around twice the rms
    // step, arriving once every PINK_NOISE_SECONDS, which is the one artefact in a noise
    // signal that would look like a property of the room.
    expect(seam).toBeLessThan(4 * rmsStep);
  });

  it('is centred on zero', () => {
    let sum = 0;
    for (const x of LOOP) sum += x;
    // A DC offset would be inaudible and would still land in the lowest bands, where this
    // section does its least certain reading.
    expect(Math.abs(sum / LOOP.length)).toBeLessThan(0.005);
  });

  it('repeats for a given seed and differs between seeds', () => {
    expect(Array.from(pinkNoiseLoop(4096, seeded(7)))).toEqual(
      Array.from(pinkNoiseLoop(4096, seeded(7))),
    );
    expect(pinkNoiseLoop(4096, seeded(7))[100]).not.toEqual(
      pinkNoiseLoop(4096, seeded(8))[100],
    );
  });
});
