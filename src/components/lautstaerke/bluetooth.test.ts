import {describe, expect, test} from 'vitest';
import {
  CAL_BAND_COUNT,
  decodeCalibration,
  encodeCalibration,
  encodeWifiCredentials,
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

describe('wifi credential framing', () => {
  test('frames [ssid_len][ssid][pw_len][pw]', () => {
    const bytes = encodeWifiCredentials('Kult', 'secret');
    expect([...bytes]).toEqual([
      4, ...[...'Kult'].map((c) => c.charCodeAt(0)),
      6, ...[...'secret'].map((c) => c.charCodeAt(0)),
    ]);
  });

  test('open network has a zero-length password', () => {
    const bytes = encodeWifiCredentials('Open', '');
    expect([...bytes]).toEqual([4, ...[...'Open'].map((c) => c.charCodeAt(0)), 0]);
  });

  test('uses UTF-8 byte length, not character count', () => {
    // "ä" is two UTF-8 bytes.
    const bytes = encodeWifiCredentials('ä', '');
    expect(bytes[0]).toBe(2);
    expect([...bytes.subarray(1, 3)]).toEqual([0xc3, 0xa4]);
  });

  test('rejects empty SSID and over-long fields', () => {
    expect(() => encodeWifiCredentials('', 'pw')).toThrow();
    expect(() => encodeWifiCredentials('x'.repeat(33), '')).toThrow();
    expect(() => encodeWifiCredentials('ok', 'p'.repeat(64))).toThrow();
  });
});
