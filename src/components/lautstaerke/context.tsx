import {
  createContext,
  useContext,
  useEffect,
  useState,
  type MutableRefObject,
} from 'react';
import {
  type NoiseRecording,
  type NoiseRecording_Record as NoiseRecord,
} from '../proto/noise';

export const TOPIC = 'noise/+/record';
export const ACTIVE_WINDOW_MS = 10_000;
export const WINDOW_S = 300;
export const GAP_THRESHOLD_S = 15;

export const decodeDb = (byte: number) => 20 + byte / 2;

export type Weighting = 'A' | 'C';

// Order matters: this is the legend order within each weighting. Each Leq is a
// shade of yellow (lighter → darker as the window grows); max and peak are
// shades of orange. All lines are solid.
export const SERIES = [
  {
    label: 'LAeq,1s',
    weighting: 'A',
    stroke: '#fef08a',
    get: (r: NoiseRecord) => decodeDb(r.laeq1s),
  },
  {
    label: 'LAeq,5m',
    weighting: 'A',
    stroke: '#eab308',
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.laeq5m == null ? null : decodeDb(d.laeq5m),
  },
  {
    label: 'LAeq,30m',
    weighting: 'A',
    stroke: '#a16207',
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.laeq30m == null ? null : decodeDb(d.laeq30m),
  },
  {
    label: 'LAFmax',
    weighting: 'A',
    stroke: '#f87171',
    hidden: true,
    get: (r: NoiseRecord) => decodeDb(r.lafmax1s),
  },
  {
    label: 'LCeq,1s',
    weighting: 'C',
    stroke: '#fef08a',
    get: (r: NoiseRecord) => decodeDb(r.lceq1s),
  },
  {
    label: 'LCeq,5m',
    weighting: 'C',
    stroke: '#eab308',
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.lceq5m == null ? null : decodeDb(d.lceq5m),
  },
  {
    label: 'LCeq,30m',
    weighting: 'C',
    stroke: '#a16207',
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.lceq30m == null ? null : decodeDb(d.lceq30m),
  },
  {
    label: 'LCFmax',
    weighting: 'C',
    stroke: '#f87171',
    hidden: true,
    get: (r: NoiseRecord) => decodeDb(r.lcfmax1s),
  },
  {
    label: 'LCpeak',
    weighting: 'C',
    stroke: '#b91c1c',
    hidden: true,
    get: (r: NoiseRecord) => decodeDb(r.lcpeak1s),
  },
] as const satisfies ReadonlyArray<{
  label: string;
  weighting: Weighting;
  stroke: string;
  // hidden from the chart by default; still toggleable via the legend.
  hidden?: boolean;
  get: (r: NoiseRecord, d: NoiseRecording) => number | null;
}>;

export type DeviceState = {
  lastSeen: number;
  latest: NoiseRecord;
  // null until the device's 5-minute ring buffer is full (no data yet).
  laeq5m: number | null;
  lceq5m: number | null;
  // null until the device's 30-minute ring buffer is full.
  laeq30m: number | null;
  lceq30m: number | null;
  batteryMv?: number;
};
export type DeviceBuffer = (number | null)[][];

export type BluetoothSlice = {
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  supported: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
};

export type LautstaerkeCtx = {
  connected: boolean;
  devices: Record<string, DeviceState>;
  bus: EventTarget;
  deviceData: MutableRefObject<Record<string, DeviceBuffer>>;
  bluetooth: BluetoothSlice;
  deviceLocations: Record<string, string>;
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
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function isFresh(lastSeen: number | undefined, now: number): boolean {
  return lastSeen != null && now - lastSeen < ACTIVE_WINDOW_MS;
}

