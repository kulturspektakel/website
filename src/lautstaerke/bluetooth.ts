/// <reference types="web-bluetooth" />

// Custom GATT service exposed by the Kulturspektakel noise-monitor firmware:
// https://github.com/kulturspektakel/noisemonitor/blob/main/main/ble_publisher.c
// The service UUID is advertised in the scan response, so filtering on it
// limits the picker to our own devices.
export const BLE_SERVICE_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a00';
export const BLE_CHAR_RECORD_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a01';
export const BLE_CHAR_CAL_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a02';
export const BLE_CHAR_WIFI_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a03';

export type BleConnection = {
  device: BluetoothDevice;
  service: BluetoothRemoteGATTService;
  characteristic: BluetoothRemoteGATTCharacteristic;
  deviceName: string;
};

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

export async function connectBleDevice(): Promise<BleConnection> {
  if (!isWebBluetoothSupported()) {
    throw new Error('Web Bluetooth wird in diesem Browser nicht unterstützt.');
  }
  const device = await navigator.bluetooth.requestDevice({
    filters: [{services: [BLE_SERVICE_UUID]}],
    // The cal & wifi characteristics live under the same service, but Chrome
    // requires every characteristic UUID to be explicitly listed.
    optionalServices: [BLE_SERVICE_UUID],
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT-Server nicht verfügbar.');
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(BLE_CHAR_RECORD_UUID);
  await characteristic.startNotifications();
  const deviceName = device.name ?? device.id;
  return {device, service, characteristic, deviceName};
}

// Calibration offset is stored on the device as a signed 32-bit value in
// hundredths of a dB (so 5165 == +51.65 dB). Convert at the boundary.
export async function readCalibrationDb(
  conn: BleConnection,
): Promise<number> {
  const chr = await conn.service.getCharacteristic(BLE_CHAR_CAL_UUID);
  const value = await chr.readValue();
  if (value.byteLength !== 4) {
    throw new Error(`Unerwartete Länge der Kalibrierung: ${value.byteLength}`);
  }
  return value.getInt32(0, true) / 100;
}

export async function writeCalibrationDb(
  conn: BleConnection,
  db: number,
): Promise<void> {
  const chr = await conn.service.getCharacteristic(BLE_CHAR_CAL_UUID);
  const buf = new ArrayBuffer(4);
  new DataView(buf).setInt32(0, Math.round(db * 100), true);
  await chr.writeValueWithResponse(buf);
}

// WiFi payload: [u8 ssid_len][ssid][u8 pw_len][pw]. Limits mirror the
// firmware: SSID 1..32 bytes, password 0..63 bytes (0 = open network).
export async function writeWifiCredentials(
  conn: BleConnection,
  ssid: string,
  password: string,
): Promise<void> {
  const enc = new TextEncoder();
  const ssidBytes = enc.encode(ssid);
  const pwBytes = enc.encode(password);
  if (ssidBytes.length < 1 || ssidBytes.length > 32) {
    throw new Error('SSID muss 1–32 Byte lang sein.');
  }
  if (pwBytes.length > 63) {
    throw new Error('Passwort darf höchstens 63 Byte lang sein.');
  }
  const payload = new Uint8Array(2 + ssidBytes.length + pwBytes.length);
  payload[0] = ssidBytes.length;
  payload.set(ssidBytes, 1);
  payload[1 + ssidBytes.length] = pwBytes.length;
  payload.set(pwBytes, 2 + ssidBytes.length);
  const chr = await conn.service.getCharacteristic(BLE_CHAR_WIFI_UUID);
  await chr.writeValueWithResponse(payload);
}
