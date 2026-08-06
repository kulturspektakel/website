import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type MutableRefObject,
} from 'react';
import {type BluetoothSlice, type DeviceBuffer, type DeviceState} from './noise';

// The React half of the section: the live-pipeline context and the clock hooks.
// The shapes, the wire encoding and the freshness rules are in noise.ts, and the
// series table in series.ts — both React-free, so the server can import them.

// Only what the live pipeline alone can provide. Which devices exist, where they
// stand, and when the DB last saw them are per-page concerns: the pages listing
// devices (project locations, unassigned monitors) each get those from the query
// they already run, and pass them into DeviceRow as props.
export type LautstaerkeCtx = {
  devices: Record<string, DeviceState>;
  deviceData: MutableRefObject<Record<string, DeviceBuffer>>;
  bluetooth: BluetoothSlice;
};

export const LautstaerkeContext = createContext<LautstaerkeCtx | null>(null);

export function useLautstaerkeCtx() {
  const ctx = useContext(LautstaerkeContext);
  if (!ctx) {
    throw new Error(
      'useLautstaerkeCtx must be used inside the /lautstaerke layout',
    );
  }
  return ctx;
}

// Local 1 Hz tick — scoped to the consuming component so freshness checks
// don't re-render the whole context subtree every second.
export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Non-urgent: a freshness tick must never preempt (and thereby starve) an
    // in-flight route transition — see the setDevices note in the layout.
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
