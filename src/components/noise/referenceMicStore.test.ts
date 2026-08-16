import {describe, expect, it} from 'vitest';
import {
  emptyCalStore,
  parseUmikCal,
  readCalStore,
  rememberDevice,
  resolveCal,
  serialiseCalStore,
  storeCalFile,
  storedSerials,
  unpairDevice,
  type CalStore,
} from './referenceMicStore';

// A file of the shape miniDSP ships: one header naming the unit, then enough frequency and
// deviation pairs to pass for a response curve. The curve itself is a straight ramp — what
// is under test here is the filing, not the interpolation.
const calFile = (serial: string, points = 64) =>
  [
    `Sens Factor =.3156dB, SERNO: ${serial}`,
    ...Array.from(
      {length: points},
      (_, i) => `${20 * 1.15 ** i}\t${(i / points).toFixed(4)}`,
    ),
  ].join('\n');

const withFile = (serial: string): CalStore => {
  const result = storeCalFile(emptyCalStore(), calFile(serial));
  if (!result.ok) throw new Error(result.reason);
  return result.store;
};

describe('parseUmikCal', () => {
  // The header format miniDSP actually ships, including a value written without a leading
  // zero — which a naive number regex silently drops the sign or the digits from.
  it('reads the header', () => {
    const p = parseUmikCal('Sens Factor =.3156dB, SERNO: 7010124\n1000\t0.5\n');
    expect(p.serial).toBe('7010124');
    expect(p.sensFactorDb).toBe(0.3156);
    expect(p.cal).toEqual([[1000, 0.5]]);
  });

  it('reads a negative sens factor', () => {
    expect(parseUmikCal('Sens Factor =-.9640dB, SERNO: 1\n').sensFactorDb).toBe(
      -0.964,
    );
    expect(parseUmikCal('Sens Factor =1.2345dB, SERNO: 1\n').sensFactorDb).toBe(
      1.2345,
    );
  });

  it('skips anything that is not two numbers, and sorts by frequency', () => {
    const p = parseUmikCal('Sens Factor =0dB, SERNO: 1\n\n2000\t1\n1000\t2\nrubbish\n50\n'); // prettier-ignore
    expect(p.cal).toEqual([
      [1000, 2],
      [2000, 1],
    ]);
  });

  it('has no header to find in a bare curve', () => {
    const p = parseUmikCal('1000\t0.5\n');
    expect(p.serial).toBe(null);
    expect(p.sensFactorDb).toBe(null);
  });
});

describe('storeCalFile', () => {
  it('files a dropped file under the serial it names itself by', () => {
    const result = storeCalFile(emptyCalStore(), calFile('7010124'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.serial).toBe('7010124');
    expect(result.points).toBe(64);
    expect(storedSerials(result.store)).toEqual(['7010124']);
  });

  it('keeps the file verbatim, so it can be compared with the original', () => {
    const text = calFile('7010124');
    const result = storeCalFile(emptyCalStore(), text);
    expect(result.ok && result.store.files['7010124']).toBe(text);
  });

  // Without a serial there is nothing to file it against, and filing it under a made-up key
  // would produce a curve that follows whichever capsule is plugged in next.
  it('refuses a file with no serial, with a reason', () => {
    const result = storeCalFile(emptyCalStore(), '100\t0.1\n200\t0.2\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/SERNO/);
  });

  // Something else dropped on the panel by accident should say so rather than be stored as
  // a two-point microphone.
  it('refuses something that is not a response curve', () => {
    const result = storeCalFile(
      emptyCalStore(),
      'Sens Factor =0dB, SERNO: 1\n1000\t0.5\n',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/measurement point/);
  });

  // miniDSP reissues these, so the newer file for a unit is the one that was wanted.
  it('replaces an earlier file for the same serial', () => {
    const first = withFile('7010124');
    const second = storeCalFile(first, calFile('7010124', 128));
    expect(second.ok && second.points).toBe(128);
    expect(second.ok && storedSerials(second.store)).toEqual(['7010124']);
  });
});

describe('resolveCal', () => {
  // With one microphone and one file there is nothing to choose between, and asking anyway
  // would be a dialogue with a single option in it.
  it('takes the only stored file for an input it has never seen', () => {
    expect(resolveCal(withFile('7010124'), 'unknown-device')).toBe('7010124');
  });

  // The one case that genuinely needs a person: any guess is a curve from the wrong capsule.
  it('will not guess between several files', () => {
    const two = storeCalFile(withFile('7010124'), calFile('7010125'));
    expect(two.ok).toBe(true);
    if (!two.ok) return;
    expect(resolveCal(two.store, 'unknown-device')).toBe(null);
  });

  it('uses a pairing it learned earlier, even with several files stored', () => {
    const two = storeCalFile(withFile('7010124'), calFile('7010125'));
    if (!two.ok) return;
    const paired = rememberDevice(two.store, 'abc', '7010125');
    expect(resolveCal(paired, 'abc')).toBe('7010125');
    expect(resolveCal(paired, 'other')).toBe(null);
  });

  // Nothing here deletes a file, but storage can still name one that is not there — an
  // older version of this code, or an edit by hand. Such a pairing has to fall through to
  // the single-file rule rather than resolve to a serial with nothing behind it.
  it('ignores a pairing naming a file that is not there', () => {
    const stale = rememberDevice(withFile('7010124'), 'abc', '7010125');
    expect(resolveCal(stale, 'abc')).toBe('7010124');
    expect(resolveCal({files: {}, devices: {abc: '7010125'}}, 'abc')).toBe(
      null,
    );
  });

  it('has nothing to resolve when nothing is stored', () => {
    expect(resolveCal(emptyCalStore(), 'abc')).toBe(null);
  });

  // "No calibration for this input" is a choice, and has to outlive the panel closing.
  // Deleting the pairing instead would let the single-file rule pick the file straight back
  // up on the next connect, and the choice would read as having been ignored.
  it('remembers a deliberate choice of no calibration', () => {
    const unpaired = unpairDevice(withFile('7010124'), 'abc');
    expect(resolveCal(unpaired, 'abc')).toBe(null);
    // Only for that input — another one still gets the single stored file.
    expect(resolveCal(unpaired, 'other')).toBe('7010124');
    // And it survives a round trip through storage, where an empty value is easy to drop.
    expect(resolveCal(readCalStore(serialiseCalStore(unpaired)), 'abc')).toBe(
      null,
    );
  });

  it('can be paired again after being unpaired', () => {
    const store = rememberDevice(
      unpairDevice(withFile('7010124'), 'abc'),
      'abc',
      '7010124',
    );
    expect(resolveCal(store, 'abc')).toBe('7010124');
  });
});

describe('readCalStore', () => {
  it('round-trips', () => {
    const store = rememberDevice(withFile('7010124'), 'abc', '7010124');
    expect(readCalStore(serialiseCalStore(store))).toEqual(store);
  });

  // What is under our key was written by an older version of this code, or by hand, or by
  // nothing at all. A panel that cannot open because of it would be worse than one that has
  // forgotten a file.
  it('survives anything at all being under the key', () => {
    for (const raw of [
      null,
      '',
      'not json',
      '[]',
      'null',
      '{"files":"nope"}',
      '{"files":{"7010124":42},"devices":null}',
      '{"devices":{"abc":"7010124"}}',
    ]) {
      const store = readCalStore(raw);
      expect(store.files, raw ?? 'null').toBeTypeOf('object');
      expect(store.devices, raw ?? 'null').toBeTypeOf('object');
      // Non-string values are dropped rather than carried through as a "file".
      for (const v of Object.values(store.files))
        expect(v).toBeTypeOf('string');
    }
    expect(readCalStore('{"files":{"7010124":42}}').files).toEqual({});
    expect(readCalStore('{"devices":{"abc":"7010124"}}').devices).toEqual({
      abc: '7010124',
    });
  });
});
