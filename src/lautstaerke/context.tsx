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

export const SERIES = [
  {
    label: 'LAeq,1s',
    stroke: '#2b8cbe',
    get: (r: NoiseRecord) => decodeDb(r.laeq1s),
  },
  {
    label: 'LCeq,1s',
    stroke: '#74a9cf',
    get: (r: NoiseRecord) => decodeDb(r.lceq1s),
  },
  {
    label: 'LAFmax',
    stroke: '#e6550d',
    get: (r: NoiseRecord) => decodeDb(r.lafmax1s),
  },
  {
    label: 'LCFmax',
    stroke: '#a63603',
    get: (r: NoiseRecord) => decodeDb(r.lcfmax1s),
  },
  {
    label: 'LCpeak',
    stroke: '#756bb1',
    get: (r: NoiseRecord) => decodeDb(r.lcpeak1s),
  },
  {
    label: 'LAeq,5m',
    stroke: '#2b8cbe',
    dash: [2, 3],
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.laeq5m != null ? decodeDb(d.laeq5m) : null,
  },
  {
    label: 'LCeq,5m',
    stroke: '#74a9cf',
    dash: [2, 3],
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.lceq5m != null ? decodeDb(d.lceq5m) : null,
  },
  {
    label: 'LAeq,30m',
    stroke: '#2b8cbe',
    dash: [6, 4],
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.laeq30m != null ? decodeDb(d.laeq30m) : null,
  },
  {
    label: 'LCeq,30m',
    stroke: '#74a9cf',
    dash: [6, 4],
    get: (_r: NoiseRecord, d: NoiseRecording) =>
      d.lceq30m != null ? decodeDb(d.lceq30m) : null,
  },
] as const satisfies ReadonlyArray<{
  label: string;
  stroke: string;
  dash?: readonly number[];
  get: (r: NoiseRecord, d: NoiseRecording) => number | null;
}>;

export type DeviceState = {
  lastSeen: number;
  latest: NoiseRecord;
  // Sliding averages are optional: the firmware only emits each one once its
  // ring is fully populated, so they're undefined for the first 5/30 min
  // after boot.
  laeq5m?: number;
  lceq5m?: number;
  laeq30m?: number;
  lceq30m?: number;
  batteryMv?: number;
};
// Inner arrays hold timestamps + per-series values; series that come from
// optional protobuf fields (e.g. laeq_30m) can be null until the device has
// run long enough to populate them — uPlot renders nulls as gaps.
export type DeviceBuffer = (number | null)[][];

export type BluetoothSlice = {
  deviceName: string | null;
  connecting: boolean;
  error: string | null;
  supported: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  readCalibrationDb: () => Promise<number>;
  writeCalibrationDb: (db: number) => Promise<void>;
  writeWifiCredentials: (ssid: string, password: string) => Promise<void>;
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

