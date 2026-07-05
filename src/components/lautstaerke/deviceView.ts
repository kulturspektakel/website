import {createContext, useContext} from 'react';
import {type DeviceLocationRecord, type Weighting} from './context';
import {timeZone} from '../../utils/dateUtils';

// The weighting toggle lives in the shared header (the $device layout route),
// but drives the charts in the child views. Share it through this context so the
// header and the live/historical views stay in sync, and the choice persists
// when navigating between them.
export type DeviceViewCtx = {weighting: Weighting; toggleWeighting: () => void};

export const DeviceViewContext = createContext<DeviceViewCtx | null>(null);

export function useDeviceView() {
  const ctx = useContext(DeviceViewContext);
  if (!ctx) {
    throw new Error('useDeviceView must be used within the $device layout');
  }
  return ctx;
}

// yyyy-mm-dd in the festival timezone, for comparing a placement's day against
// the selected day.
const dayKeyFmt = new Intl.DateTimeFormat('sv-SE', {timeZone});
const dayKey = (ms: number) => dayKeyFmt.format(new Date(ms));

// Today's day key (yyyy-mm-dd, festival timezone). A historical view whose date
// equals this is still accumulating data and worth polling for new samples.
export const todayDayKey = () => dayKey(Date.now());

// The location in effect on `date` (yyyy-mm-dd), or the latest known location
// for the live view (`date` null): the most recent placement on or before the
// selected day. `locations` must be oldest-first (as deviceLocations returns
// them), so the in-effect one is simply the last that qualifies. Null when the
// device had no location by then.
export function resolveLocation(
  locations: ReadonlyArray<DeviceLocationRecord>,
  date: string | null,
): string | null {
  // Oldest-first, so the in-effect placement is the last one that qualifies.
  for (let i = locations.length - 1; i >= 0; i--) {
    const loc = locations[i]!;
    if (date == null || dayKey(loc.createdAt) <= date) return loc.name;
  }
  return null;
}

// Page title for a device: its location on the viewed day when known, else the
// bare device id. The /crew/lautstaerke/$device layout loader provides the
// location history, so route `head()` functions (which can't read React
// context) resolve it from the match chain rather than issuing another query.
export function deviceTitle(
  matches: ReadonlyArray<{routeId: string; loaderData?: unknown}>,
  device: string,
  date: string | null,
): string {
  const layout = matches.find((m) => m.routeId === '/crew/lautstaerke/$device');
  const locations = (
    layout?.loaderData as {locations?: DeviceLocationRecord[]} | undefined
  )?.locations;
  return resolveLocation(locations ?? [], date) ?? device;
}
