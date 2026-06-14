/// <reference types="web-bluetooth" />
import {createFileRoute, Outlet, useBlocker} from '@tanstack/react-router';
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
} from '../components/lautstaerke/context';
import {
  connectBleDevice,
  isWebBluetoothSupported,
  readCalibration,
  writeCalibration,
  writeWifi,
  type BleConnection,
} from '../components/lautstaerke/bluetooth';
import {createServerFn} from '@tanstack/react-start';
import {prismaClient} from '../server/prismaClient.server';
import {Toaster, toaster} from '../components/chakra-snippets/toaster';

const noiseDevices = createServerFn().handler(async () => {
  const devices = await prismaClient.device.findMany({
    where: {type: 'NOISE_MONITOR'},
    select: {
      id: true,
      lastSeen: true,
      DeviceLocation: {
        orderBy: {createdAt: 'desc'},
        take: 1,
        select: {locationName: true},
      },
    },
  });
  const deviceIds = devices.map((d) => d.id).sort();
  const deviceLocations = Object.fromEntries(
    devices.flatMap((d) =>
      d.DeviceLocation[0] ? [[d.id, d.DeviceLocation[0].locationName]] : [],
    ),
  );
  const deviceLastSeen = Object.fromEntries(
    devices.flatMap((d) =>
      d.lastSeen ? [[d.id, d.lastSeen.getTime()]] : [],
    ),
  );
  return {deviceIds, deviceLocations, deviceLastSeen};
});

export const Route = createFileRoute('/crew/lautstaerke')({
  component: LautstaerkeLayout,
  loader: async () => await noiseDevices(),
  head: () => seo({title: 'Lautstärke'}),
});

function LautstaerkeLayout() {
  const {
    deviceIds,
    deviceLocations: locations,
    deviceLastSeen,
  } = Route.useLoaderData();
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<Record<string, DeviceState>>({});
  const deviceDataRef = useRef<Record<string, DeviceBuffer>>({});

  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleConnecting, setBleConnecting] = useState(false);
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
          laeq5m: decoded.laeq5m ?? null,
          lceq5m: decoded.lceq5m ?? null,
          laeq30m: decoded.laeq30m ?? null,
          lceq30m: decoded.lceq30m ?? null,
          batteryMv: decoded.batteryMv,
        },
      }));
    },
    [],
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const minTs = Date.now() / 1000 - WINDOW_S;
      for (const data of Object.values(deviceDataRef.current)) {
        let cutoff = 0;
        while (cutoff < data[0].length && data[0][cutoff]! < minTs) cutoff++;
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
  }, [cleanupBle]);

  const connectBle = useCallback(async (): Promise<string | null> => {
    if (bleConnecting) return null;
    if (bleConnRef.current) cleanupBle();
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
        toaster.create({
          type: 'info',
          title: 'Bluetooth-Verbindung getrennt',
        });
      };
      conn.characteristic.addEventListener(
        'characteristicvaluechanged',
        onValue,
      );
      conn.device.addEventListener('gattserverdisconnected', onDisconnect);
      bleConnRef.current = conn;
      bleHandlersRef.current = {onValue, onDisconnect};
      setBleDeviceName(conn.deviceName);
      return conn.deviceName;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        !(e instanceof DOMException && e.name === 'NotFoundError') &&
        !/User cancelled/i.test(msg)
      ) {
        toaster.create({
          type: 'error',
          title: 'Bluetooth-Verbindung fehlgeschlagen',
          description: msg,
        });
      }
      return null;
    } finally {
      setBleConnecting(false);
    }
  }, [bleConnecting, cleanupBle, ingest]);

  const readCal = useCallback(async () => {
    const conn = bleConnRef.current;
    if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
    return readCalibration(conn);
  }, []);

  const writeCal = useCallback(async (offsetsDb: number[]) => {
    const conn = bleConnRef.current;
    if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
    await writeCalibration(conn, offsetsDb);
  }, []);

  const writeWifiCreds = useCallback(
    async (ssid: string, password: string) => {
      const conn = bleConnRef.current;
      if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
      await writeWifi(conn, ssid, password);
    },
    [],
  );

  useEffect(() => {
    return () => cleanupBle();
  }, [cleanupBle]);

  // Warn before navigating away or reloading while connected over Bluetooth —
  // leaving the page tears down the BLE connection. Navigating between pages
  // under /crew/lautstaerke keeps the layout (and the connection) mounted, so
  // those moves should not be blocked.
  useBlocker({
    disabled: !bleDeviceName,
    enableBeforeUnload: () => bleDeviceName != null,
    shouldBlockFn: ({next}) => {
      if (next.fullPath.startsWith(Route.fullPath)) return false;
      return !window.confirm(
        'Du bist über Bluetooth verbunden. Wenn du die Seite verlässt, wird die Verbindung getrennt. Trotzdem fortfahren?',
      );
    },
  });

  const ctx = useMemo<LautstaerkeCtx>(
    () => ({
      connected,
      devices,
      deviceData: deviceDataRef,
      deviceIds,
      deviceLocations: locations,
      deviceLastSeen,
      bluetooth: {
        deviceName: bleDeviceName,
        connecting: bleConnecting,
        supported: bleSupported,
        connect: connectBle,
        disconnect: disconnectBle,
        readCalibration: readCal,
        writeCalibration: writeCal,
        writeWifi: writeWifiCreds,
      },
    }),
    [
      connected,
      devices,
      deviceIds,
      locations,
      deviceLastSeen,
      bleDeviceName,
      bleConnecting,
      bleSupported,
      connectBle,
      disconnectBle,
      readCal,
      writeCal,
      writeWifiCreds,
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
        <Toaster />
      </DarkMode>
    </LautstaerkeContext.Provider>
  );
}
