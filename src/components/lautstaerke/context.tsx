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
} from '../../proto/noise';

export const TOPIC = 'noise/+/record';
// A device counts as online — and its live spectrum keeps showing — while its
// most recent record is younger than this. Used by both the presence
// indicator (isFresh) and the frequency chart's live/empty decision.
export const ACTIVE_WINDOW_MS = 5_000;
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
  deviceData: MutableRefObject<Record<string, DeviceBuffer>>;
  bluetooth: BluetoothSlice;
  // All NOISE_MONITOR device ids from the database (sorted). This is the set of
  // rows rendered in the list; MQTT only drives each row's activity indicator.
  deviceIds: string[];
  deviceLocations: Record<string, string>;
  // Last-seen timestamp (epoch ms) from the DB's Device.lastSeen, per device.
  // For a live MQTT message we use its receive time instead; see the list view.
  deviceLastSeen: Record<string, number>;
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

const relativeTime = new Intl.RelativeTimeFormat('de-DE', {numeric: 'auto'});

// German relative time (e.g. "vor 5 Minuten") for a past timestamp.
export function formatLastSeen(ts: number, now: number): string {
  const diffS = Math.round((ts - now) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 60) return relativeTime.format(diffS, 'second');
  if (abs < 3600) return relativeTime.format(Math.round(diffS / 60), 'minute');
  if (abs < 86400) return relativeTime.format(Math.round(diffS / 3600), 'hour');
  return relativeTime.format(Math.round(diffS / 86400), 'day');
}

