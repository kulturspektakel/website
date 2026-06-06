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
// Live samples arrive ~1/s; break the line (and treat the cursor as "in a gap")
// once consecutive samples are more than this far apart — i.e. a few seconds of
// missing data, while tolerating normal sub-second delivery jitter.
export const GAP_THRESHOLD_S = 3;

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

// A device's location history; `createdAt` is epoch ms. Fetched by
// deviceLocations (noiseHistory.server) and resolved per viewed day by
// resolveLocation (deviceView). Isomorphic type, so it lives here next to the
// other shared shapes rather than in a client- or server-only module.
export type DeviceLocationRecord = {name: string; createdAt: number};

// One per-minute aggregate row from the historical query; every level is
// already decoded to dB. Lives here next to HISTORY_SERIES so the `col` mapping
// below can be checked against it; the query that produces it is in
// noiseHistory.server.ts.
export type HistoryRow = {
  minute_epoch: number;
  laeq_1m: number;
  laeq_5m: number;
  laeq_30m: number;
  lafmax: number;
  lceq_1m: number;
  lceq_5m: number;
  lceq_30m: number;
  lcfmax: number;
  lcpeak: number;
};

// Parallel to SERIES, for the historical (per-day) page. Same order, strokes,
// weightings and hidden flags — the only difference is the "fast" window is one
// minute instead of one second (Leq,1m vs Leq,1s). `col` maps each series to a
// column of the per-minute SQL aggregation (see noiseHistory.server.ts); values
// come back already decoded to dB, so no `get`/decodeDb is needed here.
export const HISTORY_SERIES = [
  {label: 'LAeq,1m', weighting: 'A', stroke: '#fef08a', col: 'laeq_1m'},
  {label: 'LAeq,5m', weighting: 'A', stroke: '#eab308', col: 'laeq_5m'},
  {label: 'LAeq,30m', weighting: 'A', stroke: '#a16207', col: 'laeq_30m'},
  {label: 'LAFmax', weighting: 'A', stroke: '#f87171', hidden: true, col: 'lafmax'},
  {label: 'LCeq,1m', weighting: 'C', stroke: '#fef08a', col: 'lceq_1m'},
  {label: 'LCeq,5m', weighting: 'C', stroke: '#eab308', col: 'lceq_5m'},
  {label: 'LCeq,30m', weighting: 'C', stroke: '#a16207', col: 'lceq_30m'},
  {label: 'LCFmax', weighting: 'C', stroke: '#f87171', hidden: true, col: 'lcfmax'},
  {label: 'LCpeak', weighting: 'C', stroke: '#b91c1c', hidden: true, col: 'lcpeak'},
] as const satisfies ReadonlyArray<{
  label: string;
  weighting: Weighting;
  stroke: string;
  hidden?: boolean;
  col: keyof HistoryRow;
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

