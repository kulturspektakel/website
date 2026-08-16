import {describe, expect, it} from 'vitest';
import {formatCalibration, parseCalibration} from './useCalibrationClipboard';
import {CAL_BAND_COUNT, CAL_MAX_DB, CAL_STEP_DB} from './bluetooth';

// Pasting a bad set of trims onto a device is the failure worth guarding: the
// count and the snapping are what keep an arbitrary clipboard from reaching the
// hardware.

const values = (n: number, v = 0) => Array.from({length: n}, () => v);

describe('parseCalibration', () => {
  it('accepts exactly CAL_BAND_COUNT values', () => {
    const parsed = parseCalibration(values(CAL_BAND_COUNT, 1.5).join('\n'));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.offsets).toHaveLength(CAL_BAND_COUNT);
  });

  it('rejects the wrong count, saying what it got', () => {
    const parsed = parseCalibration(values(5).join('\n'));
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.reason).toContain('got 5');
  });

  it('rejects non-numeric values', () => {
    const parts = values(CAL_BAND_COUNT, 1);
    parts[3] = NaN;
    expect(parseCalibration(parts.join('\n')).ok).toBe(false);
    expect(
      parseCalibration(
        values(CAL_BAND_COUNT - 1, 1)
          .concat()
          .join('\n') + '\nx',
      ).ok,
    ).toBe(false);
  });

  it('takes whitespace or commas, so a spreadsheet column and a CSV line both work', () => {
    expect(parseCalibration(values(CAL_BAND_COUNT, 2).join(', ')).ok).toBe(
      true,
    );
    expect(parseCalibration(values(CAL_BAND_COUNT, 2).join(' ')).ok).toBe(true);
    // Trailing newline from a copied column must not read as an extra value.
    expect(
      parseCalibration(values(CAL_BAND_COUNT, 2).join('\n') + '\n').ok,
    ).toBe(true);
  });

  it('snaps to the slider step', () => {
    const parsed = parseCalibration(values(CAL_BAND_COUNT, 1.3).join('\n'));
    expect(parsed.ok && parsed.offsets[0]).toBe(1.5);
    expect(
      parsed.ok && parsed.offsets.every((v) => v % CAL_STEP_DB === 0),
    ).toBe(true);
  });

  it('clamps to the trim range in both directions', () => {
    const wild = values(CAL_BAND_COUNT, 0);
    wild[0] = 999;
    wild[1] = -999;
    const parsed = parseCalibration(wild.join('\n'));
    expect(parsed.ok && parsed.offsets[0]).toBe(CAL_MAX_DB);
    expect(parsed.ok && parsed.offsets[1]).toBe(-CAL_MAX_DB);
  });
});

describe('formatCalibration', () => {
  it('round-trips through parseCalibration', () => {
    const offsets = values(CAL_BAND_COUNT, 0).map(
      (_, i) => Math.round((i % 9) - 4) * CAL_STEP_DB,
    );
    const parsed = parseCalibration(formatCalibration(offsets));
    expect(parsed.ok && parsed.offsets).toEqual(offsets);
  });
});
