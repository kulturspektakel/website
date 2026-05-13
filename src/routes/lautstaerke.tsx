import {createFileRoute, Outlet} from '@tanstack/react-router';
import {useEffect, useRef, useState} from 'react';
import mqtt from 'mqtt';
import 'uplot/dist/uPlot.min.css';
import {NoiseRecording, type Record as NoiseRecord} from '../proto/noise';
import {seo} from '../utils/seo';
import {
  LautstaerkeContext,
  SERIES,
  TOPIC,
  WINDOW_S,
  decodeDb,
  type DeviceBuffer,
  type DeviceState,
  type LautstaerkeCtx,
} from '../lautstaerke/context';

export const Route = createFileRoute('/lautstaerke')({
  component: LautstaerkeLayout,
  head: () => seo({title: 'Lautstärke'}),
});

function LautstaerkeLayout() {
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<Record<string, DeviceState>>({});
  const [now, setNow] = useState(() => Date.now());
  const busRef = useRef<EventTarget | null>(null);
  const deviceDataRef = useRef<Record<string, DeviceBuffer>>({});

  if (busRef.current === null) {
    busRef.current = new EventTarget();
  }

  useEffect(() => {
    const tick = setInterval(() => {
      setNow(Date.now());
      const minTs = Date.now() / 1000 - WINDOW_S;
      for (const data of Object.values(deviceDataRef.current)) {
        let cutoff = 0;
        while (cutoff < data[0].length && data[0][cutoff] < minTs) cutoff++;
        if (cutoff > 0) for (const col of data) col.splice(0, cutoff);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const bus = busRef.current!;
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
      const receiveTime = Date.now();
      const deviceName = topic.split('/')[1];
      if (!deviceName) return;
      let record: NoiseRecord | undefined;
      try {
        record = NoiseRecording.decode(payload).records[0];
      } catch (e) {
        console.error('[lautstärke] decode error', e);
        return;
      }
      if (!record) return;

      let data = deviceDataRef.current[deviceName];
      if (!data) {
        data = [[], ...SERIES.map(() => [] as number[])];
        deviceDataRef.current[deviceName] = data;
      }
      data[0].push(receiveTime / 1000);
      SERIES.forEach((s, j) => data[j + 1].push(decodeDb(record![s.key])));

      setDevices((prev) => ({
        ...prev,
        [deviceName]: {lastSeen: receiveTime, latest: record!},
      }));
      bus.dispatchEvent(
        new CustomEvent(`record:${deviceName}`, {
          detail: {record, receiveTime},
        }),
      );
    });

    return () => {
      client.removeAllListeners();
      client.end(true);
    };
  }, []);

  const ctx: LautstaerkeCtx = {
    connected,
    devices,
    bus: busRef.current,
    deviceData: deviceDataRef,
    now,
  };

  return (
    <LautstaerkeContext.Provider value={ctx}>
      <Outlet />
    </LautstaerkeContext.Provider>
  );
}
