import {startTransition, useCallback, useEffect, useRef, useState} from 'react';

import mqtt from 'mqtt';
import {NoiseRecording} from '../../proto/noise';
import {TOPIC, WINDOW_S, type DeviceBuffer, type DeviceState} from './noise';
import {SERIES, emptyBuffer} from './series';
import type {NoiseBuffers, NoiseLiveCtx} from './context';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';

/**
 * The write side of NoiseLiveCtx: the latest record per monitor, and who to wake when
 * one arrives.
 *
 * A plain closure rather than React state, for the same reason the sample buffers are a
 * ref — records arrive several times a second — but subscribed to rather than merely
 * read, because the numbers on a row *are* rendered. Splitting the listeners by device
 * name is what turns one message into one row's re-render instead of the page's.
 *
 * The notify is a transition, and that is load-bearing: see ingest below. It is also
 * why this is not a useSyncExternalStore — that hook is defined to force its updates to
 * sync priority, which is exactly the behaviour the transition exists to avoid.
 */
function createDeviceStore() {
  const states: Record<string, DeviceState> = {};
  const listeners = new Map<string, Set<() => void>>();
  return {
    get: (device: string) => states[device],
    subscribe: (device: string, listener: () => void) => {
      let subscribed = listeners.get(device);
      if (!subscribed) {
        subscribed = new Set();
        listeners.set(device, subscribed);
      }
      subscribed.add(listener);
      return () => {
        subscribed.delete(listener);
        // Checked by identity, like the clock in context.tsx: a cleanup that somehow
        // runs twice must not drop a set a later subscriber has since created, which
        // would leave that monitor's row silently unwoken.
        if (subscribed.size === 0 && listeners.get(device) === subscribed) {
          listeners.delete(device);
        }
      };
    },
    set: (device: string, state: DeviceState) => {
      states[device] = state;
      const subscribed = listeners.get(device);
      if (!subscribed?.size) return;
      startTransition(() => {
        for (const listener of subscribed) listener();
      });
    },
  };
}

// Every monitor's live 1 Hz record, off the shared MQTT broker: the latest reading
// per device (a store subscribed to by name, for the numbers and the freshness dots)
// and a rolling WINDOW_S buffer per device (a ref, for the charts).
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
  // The two halves the layout provides separately — see NoiseBuffersContext — plus
  // the ingest the Bluetooth link needs.
}): {live: NoiseLiveCtx; deviceData: NoiseBuffers; ingest: Ingest} {
  // One store for the layout's lifetime, so the context value it becomes never changes
  // and a row's subscription is established once.
  const [live] = useState(createDeviceStore);
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

      // Wakes only what is watching this monitor, and does it as a transition. The
      // priority is the load-bearing part: MQTT records arrive several times a second,
      // and as *urgent* updates they preempt (and, on slower/mobile renders,
      // permanently starve) TanStack Router's route transition — the URL commits but
      // the detail view never swaps in. The live values lag at most a frame, which is
      // imperceptible here.
      live.set(deviceName, {lastSeen: receiveTime, latest: decoded});
    },
    [ensureBuffer, live],
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

  return {live, deviceData, ingest};
}

export type Ingest = (
  deviceName: string,
  payload: Uint8Array,
  receiveTime: number,
) => void;
