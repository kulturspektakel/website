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

const DAY_MS = 24 * 60 * 60 * 1000;

// Which of the two a window that wide wants to be labelled with. Below a day an HH:MM
// reading is unambiguous; at a day or more the same clock time comes round again, so
// the label has to carry the date. Keyed on the span rather than on the data, because
// what decides it is whether two points in the window could share a clock time.
//
// (HistoryView keeps its own, wider threshold: its window is a day the user picked,
// and a slight zoom out of one shouldn't start printing dates.)
export const spanTimeFormat = (spanMs: number): ((ts: number) => string) =>
  spanMs < DAY_MS ? fmtHourMinute : fmtDayHourMinute;

// How a single pointed-at instant reads, decided once for everything that points at
// one. The row charts' tooltip and the timeline's playhead readout show the same
// instant at the same moment — a hover writes both — so they cannot be allowed to
// print it two different ways.
//
// The rule: live is a rolling window of minutes, which wants seconds; otherwise the
// crop's own width decides, by spanTimeFormat's above. Pass the same span both are
// looking at, which on the project page is the crop, not the whole festival.
//
// In milliseconds, unlike the formatters it composes: that is the unit an instant
// travels this page in, and uPlot's seconds are a local fact of the chart. Converting
// here rather than at each caller is what lets the readout share this at all.
export const instantLabel = (
  live: boolean,
  spanMs: number,
): ((ms: number) => string) => {
  const format = live ? fmtTime : spanTimeFormat(spanMs);
  return (ms) => format(ms / 1000);
};

// Vertical-grid steps in seconds, smallest first, for the row charts' time axis.
// A fixed ladder rather than a fixed line count, so the grid reads as clock time:
// half-minute lines on a five-minute live window, quarter hours on an afternoon.
//
// It continues past an hour because a project window is a festival, i.e. days —
// capped at 1 h, a four-day range would draw a picket fence of ~100 lines. Every
// step divides the one above it, so widening the window thins the grid out instead
// of moving every line to a new offset.
const TIME_GRID_STEPS_S = [
  30,
  60,
  5 * 60,
  15 * 60,
  30 * 60,
  60 * 60,
  2 * 60 * 60,
  3 * 60 * 60,
  6 * 60 * 60,
  12 * 60 * 60,
  24 * 60 * 60,
];

// The step for a `spanSeconds` window drawn `widthPx` wide: the smallest one that
// leaves at least `minSpacePx` between lines. A window wider than the ladder covers
// (a project can be given any dates at all) gets the exact step that fits — off the
// clock grid, but only in a case no ladder would have covered anyway.
//
// Never zero, and never so fine that the lines merge: uPlot picks the increment for
// an axis itself, and when nothing clears its minimum spacing it settles on zero,
// whose split generator loops without ever advancing. Deciding it here instead
// makes that unreachable — and testable.
export function timeGridStepS(
  spanSeconds: number,
  widthPx: number,
  minSpacePx: number,
): number {
  const needed = (Math.max(0, spanSeconds) * minSpacePx) / Math.max(1, widthPx);
  return TIME_GRID_STEPS_S.find((step) => step >= needed) ?? needed;
}

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

// The same question asked of one series' own samples rather than of the x column:
// a gap wherever consecutive *non-null* values of this series are further apart than
// `gapThresholdX`, and uPlot's null-derived gaps discarded.
//
// That discarding is the point. Where several devices share one chart, their x
// columns are the union of their sample times, so each series is null at every
// instant that belonged to another device — nulls that say nothing about whether
// *this* monitor was reporting. uPlot strokes straight through a null and renders
// gaps by clipping the list this refiner returns, so returning only the intervals
// this series was actually silent for draws each line whole and still breaks it
// where the monitor went quiet.
//
// For one device it is the rule above by another route: its column has a value at
// every x, so consecutive non-nulls are consecutive samples.
export const makeSampleGapsRefiner =
  (gapThresholdX: number): uPlot.Series.GapsRefiner =>
  (u, sIdx, i0, i1) => {
    const xs = u.data[0];
    const ys = u.data[sIdx];
    const out: [number, number][] = [];
    let prev: number | null = null;
    for (let i = i0; i <= i1; i++) {
      if (ys[i] == null) continue;
      const x = xs[i] as number;
      if (prev != null && x - prev > gapThresholdX) {
        out.push([
          Math.round(u.valToPos(prev, 'x', true)),
          Math.round(u.valToPos(x, 'x', true)),
        ]);
      }
      prev = x;
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
