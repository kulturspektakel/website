import {describe, expect, test} from 'vitest';
import {
  CAL_BAND_COUNT,
  CAL_MAX_DB,
  CAL_STEP_DB,
  decodeCalibration,
  encodeCalibration,
  encodeWifiCredentials,
  snapTrim,
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

  test('clamps to ±24 dB and never emits the −128 sentinel', () => {
    expect(encodeCalibration([24])[0]).toBe(48);
    expect(encodeCalibration([-24])[0]).toBe(0xd0); // −48 two's complement
    // Out-of-range input is clamped, not wrapped.
    expect(encodeCalibration([100])[0]).toBe(48);
    expect(encodeCalibration([-100])[0]).toBe(0xd0);
  });
});

describe('wifi credential framing', () => {
  test('frames [ssid_len][ssid][pw_len][pw]', () => {
    const bytes = encodeWifiCredentials('Kult', 'secret');
    expect([...bytes]).toEqual([
      4,
      ...[...'Kult'].map((c) => c.charCodeAt(0)),
      6,
      ...[...'secret'].map((c) => c.charCodeAt(0)),
    ]);
  });

  test('open network has a zero-length password', () => {
    const bytes = encodeWifiCredentials('Open', '');
    expect([...bytes]).toEqual([
      4,
      ...[...'Open'].map((c) => c.charCodeAt(0)),
      0,
    ]);
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

// The rule that keeps a computed trim and the byte it becomes the same number. Here rather
// than beside its caller: what is under test is the wire's step and range, which this module
// owns, and the encoder below enforces the same bound independently.
describe('snapTrim', () => {
  test('snaps to the step a byte can carry', () => {
    expect(snapTrim(-0.3)).toBe(-0.5);
    expect(snapTrim(1.24)).toBe(1);
    expect(snapTrim(1.25)).toBe(1.5);
    // Already on a step, so nothing to do.
    expect(snapTrim(2.5)).toBe(2.5);
  });

  test('clamps to the range, in both directions', () => {
    expect(snapTrim(100)).toBe(CAL_MAX_DB);
    expect(snapTrim(-100)).toBe(-CAL_MAX_DB);
  });

  test('agrees with the encoder about where the rail is', () => {
    // The two clamp independently, on purpose (see encodeCalibration). This is what says they
    // still land in the same place, which is the assumption the UI's "hit the limit" count and
    // the bytes on the wire both rest on.
    const railed = snapTrim(1000);
    expect(decodeCalibration(encodeCalibration([railed]))[0]).toBe(railed);
    expect(decodeCalibration(encodeCalibration([1000]))[0]).toBe(railed);
    expect(railed / CAL_STEP_DB).toBe(Math.round(CAL_MAX_DB / CAL_STEP_DB));
  });
});
