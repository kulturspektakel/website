import {describe, expect, test} from 'vitest';
import {
  CAL_BAND_COUNT,
  decodeCalibration,
  encodeCalibration,
} from './bluetooth';

describe('calibration codec', () => {
  test('worked examples from the spec', () => {
    // −6.5 dB → 0xF3, +3.0 dB → 0x06
    expect(encodeCalibration([-6.5])[0]).toBe(0xf3);
    expect(encodeCalibration([3.0])[0]).toBe(0x06);
    // 0xFB → −2.5 dB, 0x0A → +5.0 dB
    expect(decodeCalibration(new Uint8Array([0xfb]))[0]).toBe(-2.5);
    expect(decodeCalibration(new Uint8Array([0x0a]))[0]).toBe(5.0);
  });

  test('all zeros is exactly 31 zero bytes and round-trips', () => {
    const bytes = encodeCalibration(new Array(CAL_BAND_COUNT).fill(0));
    expect(bytes.length).toBe(31);
    expect([...bytes].every((b) => b === 0)).toBe(true);
    expect(decodeCalibration(bytes)).toEqual(new Array(CAL_BAND_COUNT).fill(0));
  });

  test('clamps to ±16 dB and never emits the −128 sentinel', () => {
    expect(encodeCalibration([16])[0]).toBe(32);
    expect(encodeCalibration([-16])[0]).toBe(0xe0); // −32 two's complement
    // Out-of-range input is clamped, not wrapped.
    expect(encodeCalibration([100])[0]).toBe(32);
    expect(encodeCalibration([-100])[0]).toBe(0xe0);
  });
});
