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
// WRITE-ONLY characteristic that pushes WiFi credentials to the device.
export const BLE_WIFI_CHAR_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a03';
// READ + NOTIFY characteristic: uint16 (little-endian) count of log files still
// waiting to upload. On subscribe the device sends one immediate notify, then a
// notify only when the count changes.
export const BLE_UPLOADS_CHAR_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a04';
// READ + NOTIFY characteristic: uint8 mirroring the device's wifi_status enum.
// Same notify convention as the other characteristics (one immediate push, then
// on change). A very short (<~1 s) "connecting" phase can be skipped in the
// notify stream, but a read always returns the exact current value.
export const BLE_WIFI_STATUS_CHAR_UUID =
  '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a05';

export type WifiStatus = 'disconnected' | 'connecting' | 'connected';

// WiFi credential byte-length limits, per the firmware. SSID is mandatory; an
// empty password means an open network.
export const WIFI_SSID_MAX_BYTES = 32;
export const WIFI_PASSWORD_MAX_BYTES = 63;

// The 31 IEC 1/3-octave nominal center frequencies (Hz), in band order: byte[i]
// of the calibration payload trims the band at BAND_FREQUENCIES[i].
export const BAND_FREQUENCIES = [
  16, 20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000,
  12500, 16000,
] as const;

export const CAL_BAND_COUNT = BAND_FREQUENCIES.length;
// UI slider bounds. The wire byte allows ±63.5 dB, but realistic trims stay
// within ±24 dB, so we clamp to that and never emit the −128 sentinel.
export const CAL_MAX_DB = 24;
export const CAL_STEP_DB = 0.5;

// "31.5 Hz" / "1.25 kHz" / "16 kHz" — Hz below 1 kHz, kHz above.
export function formatBandFrequency(hz: number): string {
  return hz < 1000 ? `${hz} Hz` : `${hz / 1000} kHz`;
}

// Each byte is a signed 8-bit offset in 0.5 dB steps (offset_dB = byte × 0.5).
// Clamping to ±48 enforces the ±24 dB UI range and guarantees we never send the
// −128 sentinel. Output is always exactly CAL_BAND_COUNT bytes.
export function encodeCalibration(offsetsDb: number[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(CAL_BAND_COUNT));
  for (let i = 0; i < CAL_BAND_COUNT; i++) {
    const step = Math.round((offsetsDb[i] ?? 0) / CAL_STEP_DB);
    const clamped = Math.max(-48, Math.min(48, step));
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

// Frame WiFi credentials as [u8 ssid_len][ssid][u8 pw_len][pw], with both
// strings UTF-8 encoded. Throws if either exceeds the firmware's byte limits or
// the SSID is empty; an empty password is allowed (open network).
export function encodeWifiCredentials(
  ssid: string,
  password: string,
): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const ssidBytes = enc.encode(ssid);
  const pwBytes = enc.encode(password);
  if (ssidBytes.length < 1 || ssidBytes.length > WIFI_SSID_MAX_BYTES) {
    throw new Error(`SSID muss 1–${WIFI_SSID_MAX_BYTES} Bytes lang sein.`);
  }
  if (pwBytes.length > WIFI_PASSWORD_MAX_BYTES) {
    throw new Error(
      `Passwort darf höchstens ${WIFI_PASSWORD_MAX_BYTES} Bytes lang sein.`,
    );
  }
  const out = new Uint8Array(
    new ArrayBuffer(1 + ssidBytes.length + 1 + pwBytes.length),
  );
  let o = 0;
  out[o++] = ssidBytes.length;
  out.set(ssidBytes, o);
  o += ssidBytes.length;
  out[o++] = pwBytes.length;
  out.set(pwBytes, o);
  return out;
}

export type BleConnection = {
  device: BluetoothDevice;
  characteristic: BluetoothRemoteGATTCharacteristic;
  // Pending-uploads characteristic (Read + Notify). Absent on older firmware
  // that predates the log-upload counter, so callers must null-check it.
  uploadsCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  // WiFi-status characteristic (Read + Notify). Absent on older firmware, so
  // callers must null-check it.
  wifiStatusCharacteristic: BluetoothRemoteGATTCharacteristic | null;
  deviceName: string;
};

// Decode the little-endian uint16 pending-uploads value. Matches the ESP32's
// byte order (getUint16 with littleEndian = true).
export function decodePendingUploads(value: DataView): number {
  return value.getUint16(0, true);
}

// Subscribe to a Read+Notify characteristic: attach a value-changed listener,
// optionally do one immediate read so the current value shows without waiting
// for the first notify, and return a cleanup that detaches the listener and
// stops notifications. A null characteristic (absent on older firmware) yields a
// no-op cleanup, so callers don't have to null-check. Errors from the initial
// read and stopNotifications are swallowed — teardown must never throw.
export function subscribeCharacteristic(
  characteristic: BluetoothRemoteGATTCharacteristic | null,
  onValue: (value: DataView) => void,
  {readInitial = true}: {readInitial?: boolean} = {},
): () => void {
  if (!characteristic) return () => {};
  const handler = (e: Event) => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
    if (value) onValue(value);
  };
  characteristic.addEventListener('characteristicvaluechanged', handler);
  if (readInitial) {
    characteristic
      .readValue()
      .then(onValue)
      .catch(() => {});
  }
  return () => {
    characteristic.removeEventListener('characteristicvaluechanged', handler);
    try {
      characteristic.stopNotifications().catch(() => {});
    } catch {}
  };
}

// Decode the uint8 wifi_status enum. Returns null for the 0xff subscribe
// sentinel or any unknown value, so callers can ignore non-states.
export function decodeWifiStatus(value: DataView): WifiStatus | null {
  switch (value.getUint8(0)) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connecting';
    case 2:
      return 'connected';
    default:
      return null;
  }
}

async function getCharacteristic(
  device: BluetoothDevice,
  uuid: string,
): Promise<BluetoothRemoteGATTCharacteristic> {
  const server = device.gatt;
  if (!server?.connected) throw new Error('Gerät nicht verbunden.');
  // The requestDevice service filter already grants access to this service and
  // all its characteristics, so no optionalServices entry is needed.
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  return service.getCharacteristic(uuid);
}

// Fetch a Read+Notify characteristic and start its notifications, resolving to
// null instead of throwing when the firmware doesn't expose it.
async function startOptionalNotify(
  service: BluetoothRemoteGATTService,
  uuid: string,
): Promise<BluetoothRemoteGATTCharacteristic | null> {
  try {
    const characteristic = await service.getCharacteristic(uuid);
    await characteristic.startNotifications();
    return characteristic;
  } catch {
    return null;
  }
}

export async function readCalibration(conn: BleConnection): Promise<number[]> {
  const characteristic = await getCharacteristic(
    conn.device,
    BLE_CALIBRATION_CHAR_UUID,
  );
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
  const characteristic = await getCharacteristic(
    conn.device,
    BLE_CALIBRATION_CHAR_UUID,
  );
  // Write-with-response, per the firmware spec. Web Bluetooth negotiates the MTU
  // automatically (falling back to the long-write procedure), so the 31-byte
  // write needs no explicit requestMtu — that API doesn't exist here anyway.
  await characteristic.writeValueWithResponse(encodeCalibration(offsetsDb));
}

export async function writeWifi(
  conn: BleConnection,
  ssid: string,
  password: string,
): Promise<void> {
  const characteristic = await getCharacteristic(
    conn.device,
    BLE_WIFI_CHAR_UUID,
  );
  await characteristic.writeValueWithResponse(
    encodeWifiCredentials(ssid, password),
  );
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
  // Optional on older firmware — resolve to null (rather than throw) so the
  // connection and the live spectrum still work without these characteristics.
  const [uploadsCharacteristic, wifiStatusCharacteristic] = await Promise.all([
    startOptionalNotify(service, BLE_UPLOADS_CHAR_UUID),
    startOptionalNotify(service, BLE_WIFI_STATUS_CHAR_UUID),
  ]);
  const deviceName = device.name ?? device.id;
  return {
    device,
    characteristic,
    uploadsCharacteristic,
    wifiStatusCharacteristic,
    deviceName,
  };
}
