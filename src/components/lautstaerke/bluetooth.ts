/// <reference types="web-bluetooth" />

// Custom GATT service exposed by the Kulturspektakel noise-monitor firmware:
// https://github.com/kulturspektakel/noisemonitor/blob/main/main/ble_publisher.c
// The service UUID is advertised in the scan response, so filtering on it
// limits the picker to our own devices.
export const BLE_SERVICE_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a00';
export const BLE_CHAR_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a01';
// READ + WRITE characteristic holding the 31 per-band calibration trims.
export const BLE_CALIBRATION_CHAR_UUID =
  '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a02';

// The 31 IEC 1/3-octave nominal center frequencies (Hz), in band order: byte[i]
// of the calibration payload trims the band at BAND_FREQUENCIES[i].
export const BAND_FREQUENCIES = [
  16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000,
] as const;

export const CAL_BAND_COUNT = BAND_FREQUENCIES.length;
// UI slider bounds. The wire byte allows ±63.5 dB, but realistic trims stay
// within ±16 dB, so we clamp to that and never emit the −128 sentinel.
export const CAL_MAX_DB = 16;
export const CAL_STEP_DB = 0.5;

// "31.5 Hz" / "1.25 kHz" / "16 kHz" — Hz below 1 kHz, kHz above.
export function formatBandFrequency(hz: number): string {
  return hz < 1000 ? `${hz} Hz` : `${hz / 1000} kHz`;
}

// Each byte is a signed 8-bit offset in 0.5 dB steps (offset_dB = byte × 0.5).
// Clamping to ±32 enforces the ±16 dB UI range and guarantees we never send the
// −128 sentinel. Output is always exactly CAL_BAND_COUNT bytes.
export function encodeCalibration(offsetsDb: number[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(CAL_BAND_COUNT));
  for (let i = 0; i < CAL_BAND_COUNT; i++) {
    const step = Math.round((offsetsDb[i] ?? 0) / CAL_STEP_DB);
    const clamped = Math.max(-32, Math.min(32, step));
    bytes[i] = clamped & 0xff; // two's complement into the unsigned byte
  }
  return bytes;
}

export function decodeCalibration(bytes: Uint8Array): number[] {
  const offsets: number[] = [];
  for (let i = 0; i < CAL_BAND_COUNT; i++) {
    const b = bytes[i] ?? 0;
    const signed = b > 127 ? b - 256 : b; // interpret as signed int8
    offsets.push(signed * CAL_STEP_DB);
  }
  return offsets;
}

export type BleConnection = {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
  deviceName: string;
};

async function getCalibrationCharacteristic(
  device: BluetoothDevice,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const server = device.gatt;
  if (!server?.connected) throw new Error('Gerät nicht verbunden.');
  // The requestDevice service filter already grants access to this service and
  // all its characteristics, so no optionalServices entry is needed.
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  return service.getCharacteristic(BLE_CALIBRATION_CHAR_UUID);
}

export async function readCalibration(conn: BleConnection): Promise<number[]> {
  const characteristic = await getCalibrationCharacteristic(conn.device);
  const value = await characteristic.readValue();
  const bytes = new Uint8Array(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  );
  return decodeCalibration(bytes);
}

export async function writeCalibration(
  conn: BleConnection,
  offsetsDb: number[],
): Promise<void> {
  const characteristic = await getCalibrationCharacteristic(conn.device);
  // Write-with-response, per the firmware spec. Web Bluetooth negotiates the MTU
  // automatically (falling back to the long-write procedure), so the 31-byte
  // write needs no explicit requestMtu — that API doesn't exist here anyway.
  await characteristic.writeValueWithResponse(encodeCalibration(offsetsDb));
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export async function connectBleDevice(): Promise<BleConnection> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth wird in diesem Browser nicht unterstützt.');
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: [{services: [BLE_SERVICE_UUID]}],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT-Server nicht verfügbar.');
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
  await characteristic.startNotifications();
  const deviceName = device.name ?? device.id;
  return {device, characteristic, deviceName};
}
