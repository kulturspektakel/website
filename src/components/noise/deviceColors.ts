import type {ChartDeviceToken} from '../../theme-noise';

const DEVICE_TOKENS: readonly ChartDeviceToken[] = [
  'chart.device.1',
  'chart.device.2',
  'chart.device.3',
  'chart.device.4',
  'chart.device.5',
  'chart.device.6',
];

/**
 * The colour a monitor's line is drawn in on a location's chart, or null where the chart
 * has only one monitor and its lines keep the series shade.
 *
 * By the monitor's place in the chart's own order — when the location first had it (see
 * locationLines) — so the chart and the header's badges, which sort by name, still agree on
 * which colour is whose. A seventh monitor wraps round to the first colour; the tooltip still
 * names it.
 */
export function deviceColor(
  lines: readonly {deviceId: string}[],
  deviceId: string,
): ChartDeviceToken | null {
  if (lines.length <= 1) return null;
  const index = lines.findIndex((l) => l.deviceId === deviceId);
  return index < 0 ? null : DEVICE_TOKENS[index % DEVICE_TOKENS.length]!;
}
