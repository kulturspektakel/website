import uPlot from 'uplot';
import {useRef, type MutableRefObject} from 'react';
import {TZDate} from '@date-fns/tz';
import {timeZone} from '../../utils/dateUtils';

// All noise charts render in festival-local time regardless of the viewer's
// timezone. The data x-values are unix epoch seconds; we reinterpret them in
// `timeZone` for both tick placement (uPlot's `tzDate`) and labels.
export const zonedDate = (ts: number) => new TZDate(ts * 1000, timeZone);

// Canvas 2D rejects `var(...)` strings, so resolve Chakra CSS variables to
// concrete colors at mount time before handing them to uPlot.
export const resolveCssVar = (cssVar: string, fallback: string): string => {
  if (typeof window === 'undefined') return fallback;
  const m = cssVar.match(/^var\((--[^,)]+)(?:,\s*([^)]+))?\)$/);
  if (!m) return cssVar;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(m[1])
    .trim();
  return v || m[2]?.trim() || fallback;
};

export const AXIS_STROKE_VAR = 'var(--chakra-colors-gray-400)';
export const GRID_STROKE_VAR = 'var(--chakra-colors-gray-700)';

// The dB axis, shared by the time chart and the band spectrum so the two read
// against the same scale when they sit side by side in the live view. 30 dB is
// below the noise floor of these mics and 110 above anything the festival
// produces, so a fixed range keeps the lines from rescaling as levels move.
export const dbAxis = {range: [30, 110] as const};

// uPlot needs a concrete pixel height, and the container is flex-sized, so it
// can measure 0 before layout settles — fall back rather than collapse.
export const plotHeight = (container: HTMLElement, fallback: number): number =>
  Math.max(100, container.clientHeight || fallback);

// uPlot's cursor coordinates are relative to the plotting area; offset by it to
// anchor a React tooltip in container coordinates.
export const cursorAnchor = (
  u: uPlot,
  container: HTMLElement,
  left: number,
  top: number,
): {left: number; top: number} => {
  const over = u.over.getBoundingClientRect();
  const root = container.getBoundingClientRect();
  return {left: over.left - root.left + left, top: over.top - root.top + top};
};

// Both charts stroke their axes, grid and ticks identically off the same two
// Chakra variables; only the resolution differs (they're read at mount).
export const chartAxisStyle = (): {
  stroke: string;
  grid: {stroke: string};
  ticks: {stroke: string};
} => {
  const gridStroke = resolveCssVar(GRID_STROKE_VAR, '#374151');
  return {
    stroke: resolveCssVar(AXIS_STROKE_VAR, '#9ca3af'),
    grid: {stroke: gridStroke},
    ticks: {stroke: gridStroke},
  };
};

const pad2 = (n: number) => String(n).padStart(2, '0');

// HH:MM:SS — live chart x-axis (rolling seconds window), in `timeZone`.
export const fmtTime = (ts: number) => {
  const d = zonedDate(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// HH:MM — historical chart x-axis (per-minute, within a day), in `timeZone`.
export const fmtHourMinute = (ts: number) => {
  const d = zonedDate(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// dd.MM. HH:MM — historical x-axis for a timeframe spanning more than a day,
// where a bare HH:MM would repeat and read ambiguously.
export const fmtDayHourMinute = (ts: number) => {
  const d = zonedDate(ts);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}. ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Renders an explicit gap whenever consecutive samples are further apart than
// `gapThresholdX` on the x-axis (seconds for live, minutes-as-seconds for
// history) — uPlot otherwise draws a continuous line across missing data.
export const makeGapsRefiner =
  (gapThresholdX: number): uPlot.Series.GapsRefiner =>
  (u, _sIdx, i0, i1, nullGaps) => {
    const xs = u.data[0];
    const out = nullGaps.slice();
    for (let i = i0; i < i1; i++) {
      if ((xs[i + 1] as number) - (xs[i] as number) > gapThresholdX) {
        out.push([
          Math.round(u.valToPos(xs[i] as number, 'x', true)),
          Math.round(u.valToPos(xs[i + 1] as number, 'x', true)),
        ]);
      }
    }
    return out;
  };

// A ref that always holds the latest value, for reading current props inside a
// long-lived plot closure without making them effect dependencies — a chart
// must not be torn down and rebuilt because a callback got a new identity.
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
