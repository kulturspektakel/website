/// <reference types="web-bluetooth" />
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  connectBleDevice,
  decodePendingUploads,
  decodeWifiStatus,
  isWebBluetoothSupported,
  readCalibration,
  subscribeCharacteristic,
  writeCalibration,
  writeWifi,
  type BleConnection,
  type WifiStatus,
} from './bluetooth';
import {toaster} from '../chakra-snippets/toaster';
import {errorMessage, errorToast} from './toast';
import {type BluetoothSlice} from './noise';
import type {Ingest} from './useNoiseStream';

// The Web Bluetooth link to one monitor: the GATT connection plus the three
// characteristics it exposes (the 1 Hz record stream, the pending-upload count,
// and the WiFi status), and the calibration/WiFi writes that go back over it.
//
// Records read over BLE are handed to the same `ingest` the MQTT stream uses, so
// a connected device plots identically whichever way its samples arrive.
// `connectedDevice` is written here and read by the stream, which is what stops
// a connected device being ingested twice; it is a ref rather than state
// precisely so that connecting doesn't re-run the stream's effect and drop the
// MQTT client.
export function useBleDevice({
  ingest,
  connectedDevice,
}: {
  ingest: Ingest;
  connectedDevice: {current: string | null};
}): BluetoothSlice {
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [supported, setSupported] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<number | null>(null);
  const [wifiStatus, setWifiStatus] = useState<WifiStatus | null>(null);

  useEffect(() => {
    setSupported(isWebBluetoothSupported());
  }, []);

  const connRef = useRef<BleConnection | null>(null);
  // Teardown callbacks registered while connecting (one per characteristic
  // subscription plus the disconnect listener); cleanup runs them all.
  const cleanupsRef = useRef<Array<() => void>>([]);

  const cleanup = useCallback(() => {
    // Detach every characteristic listener + the disconnect listener, then drop
    // the GATT link.
    for (const fn of cleanupsRef.current) {
      try {
        fn();
      } catch {}
    }
    cleanupsRef.current = [];
    try {
      connRef.current?.device.gatt?.disconnect();
    } catch {}
    connRef.current = null;
    connectedDevice.current = null;
    setDeviceName(null);
    setPendingUploads(null);
    setWifiStatus(null);
  }, [connectedDevice]);

  const disconnect = useCallback(async () => {
    cleanup();
  }, [cleanup]);

  const connect = useCallback(async (): Promise<string | null> => {
    if (connecting) return null;
    if (connRef.current) cleanup();
    setConnecting(true);
    try {
      const conn = await connectBleDevice();
      const onDisconnect = () => {
        cleanup();
        toaster.create({
          type: 'info',
          title: 'Bluetooth disconnected',
        });
      };
      conn.device.addEventListener('gattserverdisconnected', onDisconnect);
      // Each subscription reads its current value on connect and updates on
      // notify; the record stream is live-only (no initial read) so we don't
      // plot a stale sample. Every registered cleanup runs in cleanup().
      cleanupsRef.current = [
        subscribeCharacteristic(
          conn.characteristic,
          (value) =>
            ingest(
              conn.deviceName,
              new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
              Date.now(),
            ),
          {readInitial: false},
        ),
        subscribeCharacteristic(conn.uploadsCharacteristic, (value) =>
          setPendingUploads(decodePendingUploads(value)),
        ),
        subscribeCharacteristic(conn.wifiStatusCharacteristic, (value) => {
          // Ignore the 0xff subscribe sentinel / unknown values (decode → null).
          const status = decodeWifiStatus(value);
          if (status) setWifiStatus(status);
        }),
        () =>
          conn.device.removeEventListener(
            'gattserverdisconnected',
            onDisconnect,
          ),
      ];
      connRef.current = conn;
      // Before the state update, so the stream stops taking this device's MQTT
      // copies from the moment its characteristic is subscribed.
      connectedDevice.current = conn.deviceName;
      setDeviceName(conn.deviceName);
      return conn.deviceName;
    } catch (e) {
      // Cancelling the chooser is not a failure, so it gets no toast.
      if (
        !(e instanceof DOMException && e.name === 'NotFoundError') &&
        !/User cancelled/i.test(errorMessage(e))
      ) {
        errorToast('Bluetooth connection failed')(e);
      }
      return null;
    } finally {
      setConnecting(false);
    }
  }, [connecting, cleanup, ingest, connectedDevice]);

  const readCal = useCallback(async () => {
    const conn = connRef.current;
    if (!conn) throw new Error('No device connected over Bluetooth.');
    return readCalibration(conn);
  }, []);

  const writeCal = useCallback(async (offsetsDb: number[]) => {
    const conn = connRef.current;
    if (!conn) throw new Error('No device connected over Bluetooth.');
    await writeCalibration(conn, offsetsDb);
  }, []);

  const writeWifiCreds = useCallback(async (ssid: string, password: string) => {
    const conn = connRef.current;
    if (!conn) throw new Error('No device connected over Bluetooth.');
    await writeWifi(conn, ssid, password);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return useMemo(
    () => ({
      deviceName,
      connecting,
      supported,
      pendingUploads,
      wifiStatus,
      connect,
      disconnect,
      readCalibration: readCal,
      writeCalibration: writeCal,
      writeWifi: writeWifiCreds,
    }),
    [
      deviceName,
      connecting,
      supported,
      pendingUploads,
      wifiStatus,
      connect,
      disconnect,
      readCal,
      writeCal,
      writeWifiCreds,
    ],
  );
}
