import {describe, expect, it} from 'vitest';
import {BAND_FREQUENCIES, CAL_BAND_COUNT} from './bluetooth';
import {
  audioInputOptions,
  audioOutputOptions,
  bandBins,
  bandDb,
  bandPower,
  blackmanWindow,
  createBandAccumulator,
  DEVICE_FFT_SIZE,
  DEVICE_SAMPLE_RATE,
  interpolateCal,
  outputChannelOptions,
  MEAN_W2_BLACKMAN,
  refCorrectionBands,
  referenceMicFor,
  sensitivityFromSensFactor,
  settingsWarnings,
  type BandBin,
} from './referenceMic';

const BINS = bandBins(DEVICE_SAMPLE_RATE, DEVICE_FFT_SIZE);

// One AnalyserNode frame, as the browser hands it over: 20·log10(|X[k]|/fftSize) per bin,
// −Infinity where there is nothing. Built here rather than mocked because the numbers are
// the thing under test.
const frame = (values: Record<number, number>, size = DEVICE_FFT_SIZE / 2) => {
  const out = new Float32Array(size).fill(-Infinity);
  for (const [bin, db] of Object.entries(values)) out[Number(bin)] = db;
  return out;
};

// The magnitude spectrum of a windowed sine, computed the long way — a direct DFT of the
// actual samples, over just the bins that matter. This is what makes the level assertion
// below an end-to-end check of the normalisation rather than a restatement of it: nothing
// in bandDb's derivation is used to produce its input.
function sineFrame({
  bin,
  amplitude,
  from,
  to,
}: {
  bin: number;
  amplitude: number;
  from: number;
  to: number;
}) {
  const n = DEVICE_FFT_SIZE;
  const windowed = Array.from(
    {length: n},
    (_, i) =>
      amplitude * Math.sin((2 * Math.PI * bin * i) / n) * blackmanWindow(i, n),
  );
  const out = new Float32Array(n / 2).fill(-Infinity);
  for (let k = from; k < to; k++) {
    let re = 0;
    let im = 0;
    for (let i = 0; i < n; i++) {
      const theta = (2 * Math.PI * k * i) / n;
      re += windowed[i]! * Math.cos(theta);
      im -= windowed[i]! * Math.sin(theta);
    }
    // The spec's transform divides by fftSize before taking the level.
    out[k] = 20 * Math.log10(Math.hypot(re, im) / n);
  }
  return out;
}

describe('the Blackman window', () => {
  // The spec's window is periodic — the cosines are over N, not N−1 — which is what makes
  // the closed form exact. Swapping in the symmetric spelling would leave the closed form
  // slightly wrong and every level slightly off, with nothing to notice it by.
  it('has the power gain the closed form claims', () => {
    let sum = 0;
    for (let i = 0; i < DEVICE_FFT_SIZE; i++) {
      sum += blackmanWindow(i, DEVICE_FFT_SIZE) ** 2;
    }
    expect(sum / DEVICE_FFT_SIZE).toBeCloseTo(MEAN_W2_BLACKMAN, 9);
  });
});

describe('bandBins', () => {
  // Pinned by hand against the firmware's compute_band_edges() at its own sample rate and
  // FFT size. This table *is* the compatibility contract: the two spectra are only
  // subtractable while the browser sums the same bins the device does.
  it('reproduces the firmware grid at 48 kHz over 4096 points', () => {
    expect(BINS.map((b) => b.start)).toEqual([
      1, 2, 2, 2, 3, 4, 5, 6, 8, 10, 12, 15, 19, 24, 30, 38, 48, 61, 76, 95,
      122, 152, 190, 239, 304, 380, 479, 608, 760, 950, 1216,
    ]);
    // The one upper edge that is computed rather than borrowed from the next band.
    expect(BINS[CAL_BAND_COUNT - 1]!.end).toBe(1533);
  });

  // The degeneracy at the bottom of the range, stated outright so nobody "fixes" it: three
  // of the monitor's bands are the same single FFT bin, so it reports three identical
  // numbers there and so must we.
  it('collapses 20, 25 and 31.5 Hz onto one bin, as the device does', () => {
    expect(BINS.slice(0, 4)).toEqual([
      {start: 1, end: 2},
      {start: 2, end: 3},
      {start: 2, end: 3},
      {start: 2, end: 3},
    ]);
  });

  // Asserted across rates rather than at 48 kHz, where every bin is already a literal in the
  // pinned table above and none of this could fail without that failing first.
  it('keeps DC out, stays inside Nyquist, and tiles without gaps at any rate', () => {
    for (const sampleRate of [16000, 44100, 48000, 96000]) {
      const bins = bandBins(sampleRate, DEVICE_FFT_SIZE);
      bins.forEach(({start, end}, i) => {
        expect(start, `${sampleRate} band ${i}`).toBeGreaterThanOrEqual(1);
        expect(end, `${sampleRate} band ${i}`).toBeLessThanOrEqual(DEVICE_FFT_SIZE / 2); // prettier-ignore
        // A band begins where the one below it ended, unless that one had to be widened to
        // its single bin — so never before it, and never past its end.
        if (i > 0) {
          expect(start).toBeGreaterThanOrEqual(bins[i - 1]!.start);
          expect(start).toBeLessThanOrEqual(bins[i - 1]!.end);
        }
      });
    }
  });

  // A browser that could not be talked into 48 kHz still has to land the bands somewhere
  // sensible, so the grid is computed from the rate in hand rather than assumed.
  it('re-derives the grid at another sample rate', () => {
    const at441 = bandBins(44100, DEVICE_FFT_SIZE);
    expect(at441[18]!.start).toBe(83); // the 1 kHz band's lower edge at 10.767 Hz/bin
  });

  // Above Nyquist there is nothing to sum, and an empty band is the honest result — it
  // reads as "not measured" all the way up to the chart rather than as silence.
  it('leaves bands above Nyquist empty', () => {
    const narrow = bandBins(16000, DEVICE_FFT_SIZE);
    // 10 kHz, 12.5 kHz and 16 kHz all sit past an 8 kHz Nyquist.
    for (const i of [28, 29, 30]) {
      expect(narrow[i]!.end).toBe(narrow[i]!.start);
    }
    expect(bandDb(bandPower(frame({}), narrow), {sensitivityDb: 120})[30]).toBe(
      null,
    );
  });
});

describe('bandDb', () => {
  // The whole point of the file, checked end to end: a full-scale sine has to come back as
  // exactly the microphone's sensitivity, because that is what a sensitivity *is* — the
  // level that drives the input to full scale. Every term has to be right for this to
  // land: the one-sided fold, the Parseval division by the window's power gain, and the
  // 3.01 dB that says 0 dBFS means a sine rather than an RMS of one.
  it('reads a full-scale sine as the sensitivity itself', () => {
    // Bin 85 = 996.09 Hz, comfortably inside the 1 kHz band (bins 76…94), so its whole
    // mainlobe is captured and none of it lands in a neighbour.
    const spectrum = sineFrame({bin: 85, amplitude: 1, from: 60, to: 110});
    const db = bandDb(bandPower(spectrum, BINS), {sensitivityDb: 120});
    expect(db[18]).toBeCloseTo(120, 2);
  });

  // Halving the amplitude is 6 dB, whatever the anchor — the check that the log is on
  // power and not on amplitude twice over.
  it('follows amplitude at 20·log10', () => {
    const full = bandDb(
      bandPower(sineFrame({bin: 85, amplitude: 1, from: 60, to: 110}), BINS),
      {sensitivityDb: 120},
    );
    const half = bandDb(
      bandPower(sineFrame({bin: 85, amplitude: 0.5, from: 60, to: 110}), BINS),
      {sensitivityDb: 120},
    );
    expect(full[18]! - half[18]!).toBeCloseTo(6.0206, 3);
  });

  it('shifts with the sensitivity and the per-band correction', () => {
    const power = bandPower(sineFrame({bin: 85, amplitude: 1, from: 60, to: 110}), BINS); // prettier-ignore
    const plain = bandDb(power, {sensitivityDb: 100});
    const corrected = bandDb(power, {
      sensitivityDb: 100,
      correction: BAND_FREQUENCIES.map(() => -1.5),
    });
    expect(plain[18]).toBeCloseTo(100, 2);
    expect(corrected[18]).toBeCloseTo(98.5, 2);
  });

  // −Infinity out of the browser, or a band nothing reached, has to read as a gap. A
  // −Infinity that survived would be drawn as a line to the floor of the chart, which is a
  // measurement claim we have not made.
  it('reports a silent band as no reading rather than as −Infinity', () => {
    const db = bandDb(bandPower(frame({}), BINS), {sensitivityDb: 120});
    expect(db).toHaveLength(CAL_BAND_COUNT);
    expect(db.every((v) => v === null)).toBe(true);
  });
});

describe('createBandAccumulator', () => {
  // Deliberately distinguishable from silence: a backgrounded tab delivers no frames at
  // all, and a second nobody measured must not be averaged in as one.
  it('drains to null when no frame arrived', () => {
    expect(createBandAccumulator(BINS).drain()).toBe(null);
  });

  // Power, not decibels — the same energetic mean leq.ts takes, and the same one the
  // firmware takes between its ~23 FFTs a second. 60 dB and 70 dB average to 67.4.
  it('averages frames on power and resets', () => {
    const bins: BandBin[] = [{start: 1, end: 2}];
    const acc = createBandAccumulator(bins);
    acc.accumulate(frame({1: -60}, 4));
    acc.accumulate(frame({1: -70}, 4));
    const mean = acc.drain()!;
    expect(10 * Math.log10(mean[0]!)).toBeCloseTo(-62.6, 1);
    expect(acc.drain()).toBe(null);
  });
});

describe('interpolateCal', () => {
  const cal = [
    [100, 0],
    [1000, 2],
    [10000, -4],
  ] as const;

  it('interpolates on log frequency', () => {
    // 316.2 Hz is the geometric midpoint of 100 and 1000, so it takes half the step.
    expect(interpolateCal(cal, Math.sqrt(100 * 1000))).toBeCloseTo(1, 6);
    expect(interpolateCal(cal, 1000)).toBe(2);
  });

  // A cal file stops where the measurement stopped. Extrapolating its last slope would
  // invent data exactly where a microphone is least predictable.
  it('holds flat outside the measured range', () => {
    expect(interpolateCal(cal, 5)).toBe(0);
    expect(interpolateCal(cal, 40000)).toBe(-4);
  });

  it('is a no-op without a curve', () => {
    expect(interpolateCal([], 1000)).toBe(0);
  });
});

describe('refCorrectionBands', () => {
  // The sign, which is the one thing here that can be wrong while still looking right: the
  // file says how much the unit over-reports, so the correction is the negative of it.
  // Backwards, and the error doubles instead of cancelling.
  it('negates the file, because the file is the error and not the fix', () => {
    expect(refCorrectionBands([[1000, 2]])[18]).toBe(-2);
  });

  // A full set even with nothing to go on, which is what lets bandDb add without a fallback.
  it('is a full set of zeroes without a curve', () => {
    const flat = refCorrectionBands([]);
    expect(flat).toHaveLength(CAL_BAND_COUNT);
    expect(flat.every((v) => v === 0)).toBe(true);
  });
});

describe('enumerating inputs', () => {
  const input = (deviceId: string, label: string) => ({
    kind: 'audioinput',
    deviceId,
    label,
  });

  it('drops the pseudo devices that alias a real one', () => {
    expect(
      audioInputOptions(
        [
          input('default', 'Standard – MacBook Pro Mikrofon'),
          input('communications', 'Kommunikation'),
          input('abc', 'MacBook Pro Mikrofon'),
          {kind: 'audiooutput', deviceId: 'out', label: 'Lautsprecher'},
        ],
        null,
      ),
    ).toEqual([{deviceId: 'abc', label: 'MacBook Pro Mikrofon'}]);
  });

  // An id we could never select: `{deviceId: {exact: ''}}` matches nothing.
  it('drops inputs with no id and numbers the ones with no name', () => {
    expect(audioInputOptions([input('', ''), input('abc', '')], null)).toEqual([
      {deviceId: 'abc', label: 'Mikrofon 1'},
    ]);
  });

  // A picker whose current value is missing from its own list reads as showing nothing.
  it('keeps the selected input after it is unplugged', () => {
    const selected = {deviceId: 'umik', label: 'UMIK-1 Gain: 18dB'};
    expect(audioInputOptions([input('abc', 'Intern')], selected)).toEqual([
      {deviceId: 'abc', label: 'Intern'},
      selected,
    ]);
  });
});

describe('enumerating outputs', () => {
  const output = (deviceId: string, label: string) => ({
    kind: 'audiooutput',
    deviceId,
    label,
  });

  it('offers the outputs and nothing else', () => {
    expect(
      audioOutputOptions([
        output('default', 'Standard – MacBook Pro Lautsprecher'),
        output('communications', 'Kommunikation'),
        output('spk', 'MacBook Pro Lautsprecher'),
        output('hdmi', 'LG Monitor'),
        {kind: 'audioinput', deviceId: 'mic', label: 'Umik-1  Gain: 18dB'},
      ]),
    ).toEqual([
      {deviceId: 'spk', label: 'MacBook Pro Lautsprecher'},
      {deviceId: 'hdmi', label: 'LG Monitor'},
    ]);
  });

  // "Follow the system" is not one of these rows — it is the empty sink id, and the panel
  // offers it as a row of its own. So an output with no id is nothing that can be selected.
  it('drops outputs with no id and numbers the ones with no name', () => {
    expect(audioOutputOptions([output('', ''), output('spk', '')])).toEqual([
      {deviceId: 'spk', label: 'Output 1'},
    ]);
  });
});

describe('naming the channels of an output', () => {
  it('calls a pair left and right', () => {
    expect(outputChannelOptions(2)).toEqual([
      {channel: 0, label: 'Left'},
      {channel: 1, label: 'Right'},
    ]);
  });

  // Six is 5.1 in the Web Audio specification's layout table and six outputs on an
  // interface, and nothing in the browser says which of the two is plugged in — so the
  // sockets are numbered rather than named after speakers that may not exist.
  it('numbers anything wider than a pair, one-based', () => {
    expect(outputChannelOptions(6).map((c) => c.label)).toEqual([
      'Channel 1',
      'Channel 2',
      'Channel 3',
      'Channel 4',
      'Channel 5',
      'Channel 6',
    ]);
    expect(outputChannelOptions(6).map((c) => c.channel)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
  });

  // The panel shows no picker below two, so these are the shapes it never renders rather
  // than states it has to describe — but a destination reports 0 before a context has one.
  it('has nothing to offer for a single channel or none', () => {
    expect(outputChannelOptions(1)).toEqual([{channel: 0, label: 'Channel 1'}]);
    expect(outputChannelOptions(0)).toEqual([]);
  });
});

describe('referenceMicFor', () => {
  // The name CoreAudio actually reports for the unit in use, and the two ways it could
  // arrive tidied: a different case, or the double space collapsed.
  it('matches the UMIK-1 however the name was tidied on the way', () => {
    for (const label of [
      'Umik-1  Gain: 18dB', // exactly as CoreAudio reports it
      'UMIK-1 Gain: 18dB', // upper-cased, double space collapsed
      'Default - umik-1  gain: 18db', // prefixed and lower-cased
    ]) {
      expect(referenceMicFor(label)?.name, label).toBe('miniDSP UMIK-1');
    }
  });

  // The gain is part of the identity: the same capsule at 0 dB reads 18 dB differently, and
  // being unrecognised is the wanted outcome there — an unmatched input gets no reference
  // level, so its curve is drawn without any claim about what its levels are.
  it('does not match the same microphone at another gain', () => {
    expect(referenceMicFor('Umik-1  Gain: 0dB')).toBeUndefined();
    expect(referenceMicFor('Umik-1')).toBeUndefined();
  });

  it('does not match anything else', () => {
    expect(referenceMicFor('MacBook Pro Mikrofon')).toBeUndefined();
    expect(referenceMicFor(null)).toBeUndefined();
  });
});

describe('sensitivityFromSensFactor', () => {
  // The unit whose file is in hand: +0.3156 dB against the UMIK-1's 100 dB reference. This
  // is what makes a dropped file enough on its own, so it is worth having the arithmetic
  // pinned rather than only the reasoning behind it.
  it('turns the file header into a sensitivity', () => {
    expect(sensitivityFromSensFactor(0.3156, 100)).toBeCloseTo(96.674, 3);
  });

  // Two things at once, both of which a sign error breaks. A full-scale sine is −3.01 dBFS on
  // the scale the factor is quoted on, not 0, so a unit reading exactly full scale at the
  // reference level has that reference less the crest term — drop it and every level is 3 dB
  // out. And the 6 dB between the two reference levels in circulation for the UMIK-1 is what
  // makes one check against a calibrator able to tell them apart.
  it('carries the full-scale-sine convention at either reference level', () => {
    expect(sensitivityFromSensFactor(0, 100)).toBeCloseTo(96.9897, 4);
    expect(sensitivityFromSensFactor(0, 94)).toBeCloseTo(90.9897, 4);
  });

  // A more sensitive unit reaches full scale at a *lower* level, so the factor subtracts.
  // Backwards and every unit is wrong by twice its own trim.
  it('subtracts, because a higher factor means a more sensitive capsule', () => {
    expect(sensitivityFromSensFactor(1, 100)).toBeLessThan(
      sensitivityFromSensFactor(-1, 100),
    );
  });
});
