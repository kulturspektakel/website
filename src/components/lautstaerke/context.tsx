import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type MutableRefObject,
} from 'react';
import {type BluetoothSlice, type DeviceBuffer, type DeviceState} from './noise';

// The React half of the section: the two live-pipeline contexts and the clock
// hooks. The shapes, the wire encoding and the freshness rules are in noise.ts,
// and the series table in series.ts — both React-free, so the server can import
// them.
//
// Two contexts rather than one, because the MQTT stream and the Bluetooth link
// are two independent things that happen to be provided by the same layout: the
// map and the device list want only the former, the calibration and WLAN menus
// only the latter. Keeping them apart is what lets each be its own hook.

// Only what the live pipeline alone can provide. Which devices exist, where they
// stand, and when the DB last saw them are per-page concerns: the pages listing
// devices (project locations, unassigned monitors) each get those from the query
// they already run, and pass them into DeviceRow as props.
export type NoiseLiveCtx = {
  devices: Record<string, DeviceState>;
  // The rolling per-device sample buffers, deliberately outside React: they are
  // rewritten several times a second and read directly by uPlot, so re-rendering
  // on every sample would be both pointless and too slow.
  deviceData: MutableRefObject<Record<string, DeviceBuffer>>;
  // The buffer for one device, created empty if the stream hasn't seen it yet.
  // A view can mount before the device's first record arrives, and it needs
  // something with the right column count to hand the chart. Idempotent, so
  // calling it while rendering is safe.
  ensureBuffer: (device: string) => DeviceBuffer;
};

export const NoiseLiveContext = createContext<NoiseLiveCtx | null>(null);
export const BluetoothContext = createContext<BluetoothSlice | null>(null);

export function useNoiseLive(): NoiseLiveCtx {
  const ctx = useContext(NoiseLiveContext);
  if (!ctx) {
    throw new Error('useNoiseLive must be used inside the /lautstaerke layout');
  }
  return ctx;
}

export function useBluetooth(): BluetoothSlice {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used inside the /lautstaerke layout');
  }
  return ctx;
}

// Local 1 Hz tick — scoped to the consuming component so freshness checks
// don't re-render the whole context subtree every second.
export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Non-urgent: a freshness tick must never preempt (and thereby starve) an
    // in-flight route transition — see the setDevices note in useNoiseStream.
    const id = setInterval(
      () => startTransition(() => setNow(Date.now())),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// useTick, withheld until after mount and slow by default.
//
// useTick seeds itself during render, which is fine when the value only drives a
// freshness dot. Where the clock decides *layout* — the range picker's right edge
// is the current time — a value read during render would differ between the server
// and client renders. So this yields null for that one paint and callers fall back
// to something deterministic.
export function useNowAfterMount(intervalMs = 60_000): number | null {
  const now = useTick(intervalMs);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? now : null;
}
