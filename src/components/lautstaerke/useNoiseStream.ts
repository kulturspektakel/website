import {startTransition, useCallback, useEffect, useRef, useState} from 'react';
import mqtt from 'mqtt';
import {NoiseRecording} from '../../proto/noise';
import {TOPIC, WINDOW_S, type DeviceBuffer, type DeviceState} from './noise';
import {SERIES, emptyBuffer} from './series';
import type {NoiseLiveCtx} from './context';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

// Every monitor's live 1 Hz record, off the shared MQTT broker: the latest
// reading per device (React state, for the numbers and the freshness dots) and a
// rolling WINDOW_S buffer per device (a ref, for the charts).
//
// `ingest` is returned as well as used internally, because the Bluetooth link
// feeds the same buffers from the same device's record characteristic — see
// useBleDevice. That's also why `skipDevice` is a ref rather than a prop:
// connecting over BLE must not tear down and re-establish the MQTT client.
export function useNoiseStream({
  skipDevice,
}: {
  // The device currently being read over Bluetooth, whose MQTT copies are
  // dropped so its samples aren't ingested twice.
  skipDevice: {current: string | null};
}): NoiseLiveCtx & {ingest: Ingest} {
  const [devices, setDevices] = useState<Record<string, DeviceState>>({});
  const deviceData = useRef<Record<string, DeviceBuffer>>({});

  // Deliberately private: ingest is the only thing that may create a buffer.
  // Views that mount before a device's first record render an empty placeholder
  // instead of creating one, so nothing mutates this map during a render.
  const ensureBuffer = useCallback((device: string): DeviceBuffer => {
    let data = deviceData.current[device];
    if (!data) {
      data = emptyBuffer();
      deviceData.current[device] = data;
    }
    return data;
  }, []);

  const ingest = useCallback<Ingest>(
    (deviceName, payload, receiveTime) => {
      let decoded: NoiseRecording;
      try {
        decoded = NoiseRecording.decode(payload);
      } catch (e) {
        console.error('[lautstärke] decode error', e);
        return;
      }
      const data = ensureBuffer(deviceName);
      data[0].push(receiveTime / 1000);
      SERIES.forEach((s, j) => data[j + 1].push(s.get(decoded)));

      // Non-urgent: MQTT records arrive several times a second. As an *urgent*
      // update this preempts (and, on slower/mobile renders, permanently
      // starves) TanStack Router's route transition — the URL commits but the
      // detail view never swaps in. Demoting it to a transition lets navigation
      // win; the live values lag at most a frame, which is imperceptible here.
      startTransition(() =>
        setDevices((prev) => ({
          ...prev,
          [deviceName]: {
            lastSeen: receiveTime,
            latest: decoded,
          },
        })),
      );
    },
    [ensureBuffer],
  );

  // Drop samples that have scrolled out of the rolling window, so the buffers
  // stay bounded however long the page is left open.
  useEffect(() => {
    const tick = setInterval(() => {
      const minTs = Date.now() / 1000 - WINDOW_S;
      for (const data of Object.values(deviceData.current)) {
        let cutoff = 0;
        while (cutoff < data[0].length && data[0][cutoff]! < minTs) cutoff++;
        if (cutoff > 0) for (const col of data) col.splice(0, cutoff);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const client = mqtt.connect(BROKER_URL, {
      clean: true,
      reconnectPeriod: 2000,
      clientId: `kult-lautstaerke-${Math.random().toString(16).slice(2, 10)}`,
    });

    client.on('connect', () => {
      client.subscribe(TOPIC, {qos: 0}, (err) => {
        if (err) console.error('[lautstärke] subscribe error', err);
      });
    });
    client.on('error', (e) => console.error('[lautstärke] mqtt error', e));

    client.on('message', (topic, payload) => {
      const deviceName = topic.split('/')[1];
      if (!deviceName) return;
      if (skipDevice.current === deviceName) return;
      ingest(deviceName, payload, Date.now());
    });

    return () => {
      client.removeAllListeners();
      client.end(true);
    };
  }, [ingest, skipDevice]);

  return {devices, deviceData, ingest};
}

export type Ingest = (
  deviceName: string,
  payload: Uint8Array,
  receiveTime: number,
) => void;
