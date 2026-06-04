/// <reference types="web-bluetooth" />

// Custom GATT service exposed by the Kulturspektakel noise-monitor firmware:
// https://github.com/kulturspektakel/noisemonitor/blob/main/main/ble_publisher.c
// The service UUID is advertised in the scan response, so filtering on it
// limits the picker to our own devices.
export const BLE_SERVICE_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a00';
export const BLE_CHAR_UUID = '7ed2f2c4-69e8-4f7c-9c93-7a3b1e5d0a01';

export type BleConnection = {
  device: BluetoothDevice;
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
  });
  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT-Server nicht verfügbar.');
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const characteristic = await service.getCharacteristic(BLE_CHAR_UUID);
  await characteristic.startNotifications();
  const deviceName = device.name ?? device.id;
  return {device, characteristic, deviceName};
}
