import {type NoiseRecording} from '../../proto/noise';
import {type WifiStatus} from './bluetooth';
import {locale} from '../../utils/dateUtils';

// The section's domain core: the wire encoding, the shared shapes, and the
// freshness rules. Deliberately React-free, so the server can import it (the
// history query decodes the same bytes) without pulling in a context module.
// Anything that needs hooks lives in context.tsx; the series table, which is
// the one thing you edit to add a line to a chart, lives in series.ts.

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
// The same for stored data, which is one point per minute: half a minute of slack
// past the step. Mostly belt — a stored trace carries an explicit null for a minute
// it has nothing for, which uPlot breaks on by itself.
export const STORED_GAP_THRESHOLD_S = 90;

// Levels cross the wire as one byte per value. The history query decodes the
// same encoding in SQL (see noiseHistory.server.ts) because it decodes 1440
// rows × 10 columns per day and Postgres is the right place for that — so this
// pair is pinned by noise.test.ts rather than shared as code.
export const decodeDb = (byte: number) => 20 + byte / 2;

export type Weighting = 'A' | 'C';

// A device's location history; `createdAt` is epoch ms. Fetched by
// deviceLocations (noiseHistory.server) and resolved per viewed day by
// resolveLocation (deviceView).
export type DeviceLocationRecord = {name: string; createdAt: number};

// One row (one 60s aggregate) from the historical query; every level is already
// decoded to dB. The `col` fields of SERIES map onto these keys, and the query
// that produces it is in noiseHistory.server.ts.
export type HistoryRow = {
  minute_epoch: number;
  laeq_1m: number;
  // Read from the device's stored trailing-window columns, so null until its
  // buffer filled (and for rows predating those columns).
  laeq_5m: number | null;
  laeq_30m: number | null;
  lafmax: number;
  lceq_1m: number;
  lceq_5m: number | null;
  lceq_30m: number | null;
  lcfmax: number;
  lcpeak: number;
};

// The levels the project page can display, named as a HistoryRow names them — so the
// series table's `col` indexes both. Every series the picker offers is here, maxima
// included: LCpeak is the one a limit is usually written against, and a page that
// cannot read it would send you back to the device view for it.
export type LevelColumn = keyof Omit<HistoryRow, 'minute_epoch'>;

// One device's stored levels over a whole project, one value per minute per column.
// The index *is* the minute (see ProjectLogs.start/stepMs), so a reading is an index
// and a window is a slice — no timestamps travel, and none are searched for.
//
// `null` means "nothing to show for that minute", which covers three cases the page
// treats identically: the device reported nothing, it hadn't filled that trailing
// window yet, or it wasn't standing in this project at the time (projectLogs clips
// to each assignment). A column absent entirely is one that was null throughout.
export type DeviceLog = Partial<Record<LevelColumn, (number | null)[]>>;

// Every monitor of one project over its whole window, from projectLogs — the single
// payload the project page's map and list read when live mode is off. Sized in the
// tens of thousands of numbers, which is small enough to hold and slice locally and
// so replaces what used to be three separate per-view queries.
export type ProjectLogs = {
  // Epoch ms of index 0, and how far apart neighbouring indices are.
  start: number;
  stepMs: number;
  // Length of every column, so a caller can bound a slice without measuring one.
  minutes: number;
  devices: Record<string, DeviceLog>;
};

// The grid of a ProjectLogs, in both directions. Only the grid, so the server can
// fill columns by index before the payload exists — and it is the one invariant the
// whole payload rests on, so producer and consumers share it rather than each writing
// `(ms - start) / stepMs` and hoping they agree.
export type LogGrid = Pick<ProjectLogs, 'start' | 'stepMs'>;

// May fall outside the payload — before the project began, or past the edge a running
// festival has reached — so callers bound it themselves.
export const logMinuteIndex = (grid: LogGrid, ms: number): number =>
  Math.floor((ms - grid.start) / grid.stepMs);

export const logMinuteAt = (grid: LogGrid, index: number): number =>
  grid.start + index * grid.stepMs;

// One device's level trace, in uPlot's column-major shape: epoch *seconds* (as in
// HistoryRow.minute_epoch) against the Leq at each. Full resolution — one point per
// stored minute, the whole project long — because uPlot clips to its x-scale by
// binary search and decimates to min/max per pixel column once there are more than
// four points per pixel. Reducing it here first would cost work on every crop change
// and throw away the peaks uPlot would otherwise draw.
//
// `xs` is shared by every device of a project, so only the levels are per device. A
// minute with no reading is null rather than absent, which is what keeps that sharing
// possible — and uPlot breaks the line there of its own accord.
export type DeviceSeries = {xs: number[]; db: (number | null)[]};

export type DeviceState = {
  lastSeen: number;
  // The most recent live (1 Hz) record. Being flat, it also carries the
  // trailing 5m/30m Leq (null until the device's ring buffer is full) and
  // batteryMv (only when on battery), so no separate fields are needed here.
  latest: NoiseRecording;
};
export type DeviceBuffer = (number | null)[][];

export type BluetoothSlice = {
  deviceName: string | null;
  connecting: boolean;
  supported: boolean;
  // Count of log files the connected device still has to upload, from the
  // Read+Notify uploads characteristic. null when disconnected or when the
  // firmware doesn't expose the counter.
  pendingUploads: number | null;
  // The connected device's WiFi state, from the Read+Notify wifi-status
  // characteristic. null when disconnected or when the firmware doesn't expose
  // it.
  wifiStatus: WifiStatus | null;
  // Resolves to the connected device's name, or null if the user cancelled or
  // the connection failed (the error is exposed via `error`).
  connect: () => Promise<string | null>;
  disconnect: () => Promise<void>;
  // Per-band calibration over the connected device; both throw if not connected.
  readCalibration: () => Promise<number[]>;
  writeCalibration: (offsetsDb: number[]) => Promise<void>;
  // Push WiFi credentials to the connected device; throws if not connected.
  writeWifi: (ssid: string, password: string) => Promise<void>;
};

// Default window drives the online dot; callers wanting a different notion of
// "recent" (see LIVE_LEVEL_WINDOW_MS) pass their own. Exclusive at the edge.
export function isFresh(
  lastSeen: number | undefined,
  now: number,
  windowMs = ACTIVE_WINDOW_MS,
): boolean {
  return lastSeen != null && now - lastSeen < windowMs;
}

const relativeTime = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'});

// German relative time (e.g. "vor 5 Minuten") for a past timestamp.
export function formatLastSeen(ts: number, now: number): string {
  const diffS = Math.round((ts - now) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 60) return relativeTime.format(diffS, 'second');
  if (abs < 3600) return relativeTime.format(Math.round(diffS / 60), 'minute');
  if (abs < 86400) return relativeTime.format(Math.round(diffS / 3600), 'hour');
  return relativeTime.format(Math.round(diffS / 86400), 'day');
}
