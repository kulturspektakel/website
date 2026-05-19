/// <reference types="web-bluetooth" />
import {createFileRoute, Outlet} from '@tanstack/react-router';
import {Box} from '@chakra-ui/react';
import {DarkMode} from '../components/chakra-snippets/color-mode';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import mqtt from 'mqtt';
import 'uplot/dist/uPlot.min.css';
import {NoiseRecording} from '../proto/noise';
import {seo} from '../utils/seo';
import {
  LautstaerkeContext,
  SERIES,
  TOPIC,
  WINDOW_S,
  type DeviceBuffer,
  type DeviceState,
  type LautstaerkeCtx,
} from '../lautstaerke/context';
import {
  connectBleDevice,
  isWebBluetoothSupported,
  readCalibrationDb,
  writeCalibrationDb,
  writeWifiCredentials,
  type BleConnection,
} from '../lautstaerke/bluetooth';
import {deviceLocations} from '../server/routes/crew.lautstaerke';

export const Route = createFileRoute('/crew/lautstaerke')({
  component: LautstaerkeLayout,
  loader: async () => await deviceLocations(),
  head: () => seo({title: 'Lautstärke'}),
});

function LautstaerkeLayout() {
  const locations = Route.useLoaderData();
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<Record<string, DeviceState>>({});
  const busRef = useRef<EventTarget>(new EventTarget());
  const deviceDataRef = useRef<Record<string, DeviceBuffer>>({});

  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleConnecting, setBleConnecting] = useState(false);
  const [bleError, setBleError] = useState<string | null>(null);
  const [bleSupported, setBleSupported] = useState(false);

  useEffect(() => {
    setBleSupported(isWebBluetoothSupported());
  }, []);
  const bleConnRef = useRef<BleConnection | null>(null);
  const bleHandlersRef = useRef<{
    onValue?: (e: Event) => void;
    onDisconnect?: (e: Event) => void;
  }>({});

  const ingest = useCallback(
    (deviceName: string, payload: Uint8Array, receiveTime: number) => {
      let decoded: NoiseRecording;
      try {
        decoded = NoiseRecording.decode(payload);
      } catch (e) {
        console.error('[lautstärke] decode error', e);
        return;
      }
      const record = decoded.records[0];
      if (!record) return;

      let data = deviceDataRef.current[deviceName];
      if (!data) {
        data = [[], ...SERIES.map(() => [] as number[])];
        deviceDataRef.current[deviceName] = data;
      }
      data[0].push(receiveTime / 1000);
      SERIES.forEach((s, j) => data[j + 1].push(s.get(record, decoded)));

      setDevices((prev) => ({
        ...prev,
        [deviceName]: {
          lastSeen: receiveTime,
          latest: record,
          laeq5m: decoded.laeq5m,
          lceq5m: decoded.lceq5m,
          laeq30m: decoded.laeq30m,
          lceq30m: decoded.lceq30m,
          batteryMv: decoded.batteryMv,
        },
      }));
      busRef.current.dispatchEvent(
        new CustomEvent(`record:${deviceName}`, {
          detail: {record, receiveTime},
        }),
      );
    },
    [],
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const minTs = Date.now() / 1000 - WINDOW_S;
      for (const data of Object.values(deviceDataRef.current)) {
        let cutoff = 0;
        while (cutoff < data[0].length && (data[0][cutoff] ?? Infinity) < minTs) cutoff++;
        if (cutoff > 0) for (const col of data) col.splice(0, cutoff);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clean: true,
      reconnectPeriod: 2000,
      clientId: `kult-lautstaerke-${Math.random().toString(16).slice(2, 10)}`,
    });

    client.on('connect', () => {
      setConnected(true);
      client.subscribe(TOPIC, {qos: 0}, (err) => {
        if (err) console.error('[lautstärke] subscribe error', err);
      });
    });
    client.on('close', () => setConnected(false));
    client.on('offline', () => setConnected(false));
    client.on('error', (e) => console.error('[lautstärke] mqtt error', e));

    client.on('message', (topic, payload) => {
      const deviceName = topic.split('/')[1];
      if (!deviceName) return;
      if (bleConnRef.current?.deviceName === deviceName) return;
      ingest(deviceName, payload, Date.now());
    });

    return () => {
      client.removeAllListeners();
      client.end(true);
    };
  }, [ingest]);

  const cleanupBle = useCallback(() => {
    const conn = bleConnRef.current;
    const handlers = bleHandlersRef.current;
    if (conn) {
      if (handlers.onValue) {
        conn.characteristic.removeEventListener(
          'characteristicvaluechanged',
          handlers.onValue,
        );
      }
      if (handlers.onDisconnect) {
        conn.device.removeEventListener(
          'gattserverdisconnected',
          handlers.onDisconnect,
        );
      }
      try {
        conn.characteristic.stopNotifications().catch(() => {});
      } catch {}
      try {
        conn.device.gatt?.disconnect();
      } catch {}
    }
    bleConnRef.current = null;
    bleHandlersRef.current = {};
    setBleDeviceName(null);
  }, []);

  const disconnectBle = useCallback(async () => {
    cleanupBle();
    setBleError(null);
  }, [cleanupBle]);

  const connectBle = useCallback(async () => {
    if (bleConnecting) return;
    if (bleConnRef.current) cleanupBle();
    setBleError(null);
    setBleConnecting(true);
    try {
      const conn = await connectBleDevice();
      const onValue = (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        const value = target.value;
        if (!value) return;
        const bytes = new Uint8Array(
          value.buffer,
          value.byteOffset,
          value.byteLength,
        );
        ingest(conn.deviceName, bytes, Date.now());
      };
      const onDisconnect = () => {
        cleanupBle();
        setBleError('Bluetooth-Verbindung getrennt.');
      };
      conn.characteristic.addEventListener(
        'characteristicvaluechanged',
        onValue,
      );
      conn.device.addEventListener('gattserverdisconnected', onDisconnect);
      bleConnRef.current = conn;
      bleHandlersRef.current = {onValue, onDisconnect};
      setBleDeviceName(conn.deviceName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        !(e instanceof DOMException && e.name === 'NotFoundError') &&
        !/User cancelled/i.test(msg)
      ) {
        setBleError(msg);
      }
    } finally {
      setBleConnecting(false);
    }
  }, [bleConnecting, cleanupBle, ingest]);

  useEffect(() => {
    return () => cleanupBle();
  }, [cleanupBle]);

  const withConn = useCallback(
    <T,>(fn: (conn: BleConnection) => Promise<T>) =>
      async () => {
        const conn = bleConnRef.current;
        if (!conn) throw new Error('Keine Bluetooth-Verbindung.');
        return fn(conn);
      },
    [],
  );

  const ctx = useMemo<LautstaerkeCtx>(
    () => ({
      connected,
      devices,
      bus: busRef.current,
      deviceData: deviceDataRef,
      deviceLocations: locations,
      bluetooth: {
        deviceName: bleDeviceName,
        connecting: bleConnecting,
        error: bleError,
        supported: bleSupported,
        connect: connectBle,
        disconnect: disconnectBle,
        readCalibrationDb: withConn((c) => readCalibrationDb(c)),
        writeCalibrationDb: (db) =>
          withConn((c) => writeCalibrationDb(c, db))(),
        writeWifiCredentials: (ssid, password) =>
          withConn((c) => writeWifiCredentials(c, ssid, password))(),
      },
    }),
    [
      connected,
      devices,
      locations,
      bleDeviceName,
      bleConnecting,
      bleError,
      bleSupported,
      connectBle,
      disconnectBle,
      withConn,
    ],
  );

  return (
    <LautstaerkeContext.Provider value={ctx}>
      <DarkMode>
        <Box
          bg="gray.900"
          color="gray.100"
          h="100vh"
          display="flex"
          flexDirection="column"
          overflow="auto"
          p="4"
        >
          <Outlet />
        </Box>
      </DarkMode>
    </LautstaerkeContext.Provider>
  );
}
