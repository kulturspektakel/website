import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useState,
  type MutableRefObject,
} from 'react';
import {
  type BluetoothSlice,
  type DeviceBuffer,
  type DeviceState,
} from './noise';

// The React half of the section: the three live-pipeline contexts and the clock
// hooks. The shapes, the wire encoding and the freshness rules are in noise.ts,
// and the series table in series.ts — both React-free, so the server can import
// them.
//
// The MQTT stream and the Bluetooth link are kept apart because they are two
// independent things that happen to be provided by the same layout: the map and the
// device list want only the former, the calibration and Wi-Fi menus only the latter.
// Keeping them apart is what lets each be its own hook. The stream is then split again
// into records and buffers — see NoiseBuffersContext.

// Only what the live pipeline alone can provide. Which devices exist, where they
// stand, and when the DB last saw them are per-page concerns: the pages listing
// devices (project locations, unassigned monitors) each get those from the query
// they already run, and pass them down as props.
//
// The latest record per monitor, subscribed to by name rather than handed over as a
// record. It used to be the record: one piece of state, replaced wholesale on every
// arriving message, so a page watching a dozen monitors re-rendered all twelve rows
// twelve times a second — each row once for its own reading and eleven times for
// somebody else's. Now a message wakes only what is listening for that name.
//
// Never re-created, so subscribing to it is a one-time cost; read it through
// useDeviceState/useDeviceStates below rather than directly.
export type NoiseLiveCtx = {
  get: (device: string) => DeviceState | undefined;
  subscribe: (device: string, listener: () => void) => () => void;
};

/**
 * The rolling per-device sample buffers, deliberately outside React: they are
 * rewritten several times a second and read directly by uPlot, so re-rendering on
 * every sample would be both pointless and too slow.
 *
 * Read-only to consumers. A device only gets an entry once its first record arrives;
 * a view that mounts before then renders emptyBuffer() rather than creating one, so
 * nothing here is written during a render.
 */
export type NoiseBuffers = MutableRefObject<Record<string, DeviceBuffer>>;

export const NoiseLiveContext = createContext<NoiseLiveCtx | null>(null);
// Its own context, and not a field of the one above, because the two are read by
// different things for different reasons: what wants the buffers draws to a canvas off
// its own once-a-second setData and has nothing to say about an individual record
// arriving, while what wants a record renders a number for it. Both are stable objects
// now, so this is a question of what a consumer subscribes to rather than of how often
// it is handed a new value.
export const NoiseBuffersContext = createContext<NoiseBuffers | null>(null);
export const BluetoothContext = createContext<BluetoothSlice | null>(null);

export function useNoiseLive(): NoiseLiveCtx {
  const ctx = useContext(NoiseLiveContext);
  if (!ctx) {
    throw new Error('useNoiseLive must be used inside the /crew/noise layout');
  }
  return ctx;
}

export function useNoiseBuffers(): NoiseBuffers {
  const buffers = useContext(NoiseBuffersContext);
  if (!buffers) {
    throw new Error(
      'useNoiseBuffers must be used inside the /crew/noise layout',
    );
  }
  return buffers;
}

/**
 * The latest record of each of several monitors — a location's pair of them, or the
 * map's whole set of pins, which are drawn together and so render together. Returns the
 * store's own lookup, which is stable, and which is deliberately not scoped to the
 * names given: looking up a monitor you didn't list works, but nothing will wake you
 * when it reports.
 *
 * Values are read straight out of the store during render rather than mirrored into
 * state, so they are exact even on the render where `devices` changes; the state here
 * is only what wakes the component.
 */
export function useDeviceStates(
  devices: string[],
): (device: string) => DeviceState | undefined {
  const live = useNoiseLive();
  const [, onRecord] = useState(0);
  const wake = () => onRecord((n) => n + 1);
  // `devices` is captured from the render that produced the key, so reading it inside
  // the effect can't go stale — the same treatment LocationsMap gives its markers.
  const key = devices.join(' ');
  // Snapshotted for the catch-up below, since by then the store may have moved on.
  const rendered = devices.map(live.get);
  useEffect(() => {
    const unsubscribes = devices.map((device) => live.subscribe(device, wake));
    // A record that landed between this render and the subscription would otherwise go
    // unnoticed until the next one — a second here, but a second of a number claiming
    // to be current.
    if (devices.some((device, i) => live.get(device) !== rendered[i])) wake();
    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [live, key]);
  return live.get;
}

// One monitor's latest record, re-rendering only for that monitor's own messages. The
// plural above with a set of one — the throwaway array costs nothing next to keeping a
// second copy of the subscribe/catch-up/cleanup dance in step with it.
export const useDeviceState = (device: string): DeviceState | undefined =>
  useDeviceStates([device])(device);

export function useBluetooth(): BluetoothSlice {
  const ctx = useContext(BluetoothContext);
  if (!ctx) {
    throw new Error('useBluetooth must be used inside the /crew/noise layout');
  }
  return ctx;
}

// One clock per rate for the whole page, rather than one per component. A list of a
// dozen locations holds two dozen freshness checks, and an interval each meant two
// dozen commits a second at two dozen random offsets — each its own render pass and
// its own style recalculation, for a set of values that are all the same number.
// Shared, they land together in one.
const clocks = new Map<
  number,
  {listeners: Set<(now: number) => void>; timer: ReturnType<typeof setInterval>}
>();

export function subscribeToClock(
  intervalMs: number,
  listener: (now: number) => void,
) {
  let clock = clocks.get(intervalMs);
  if (!clock) {
    const listeners = new Set<(now: number) => void>();
    // Non-urgent, and one transition for all of them: a freshness tick must never
    // preempt (and thereby starve) an in-flight route transition — see the note on
    // ingest in useNoiseStream.
    const timer = setInterval(() => {
      const now = Date.now();
      startTransition(() => {
        for (const l of listeners) l(now);
      });
    }, intervalMs);
    clock = {listeners, timer};
    clocks.set(intervalMs, clock);
  }
  clock.listeners.add(listener);
  return () => {
    clock.listeners.delete(listener);
    // Nothing left to tell the time to. Stopping rather than leaving it running means
    // navigating out of the section leaves no timer behind for the session. Checked by
    // identity, so a cleanup that somehow runs twice can't stop a clock that has since
    // been started again for somebody else.
    if (clock.listeners.size === 0 && clocks.get(intervalMs) === clock) {
      clearInterval(clock.timer);
      clocks.delete(intervalMs);
    }
  };
}

// The current time, re-read every `intervalMs`. Scoped to the consuming component so
// freshness checks don't re-render the whole context subtree, but off the shared clock
// above so all of them re-render at once when they do.
export function useTick(intervalMs = 1000): number {
  // Seeded during render rather than after mount: what reads this decides whether a
  // reading is current, and a first paint saying "never seen" would be wrong.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => subscribeToClock(intervalMs, setNow), [intervalMs]);
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
