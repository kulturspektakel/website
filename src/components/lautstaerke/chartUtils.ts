import uPlot from 'uplot';
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

const pad2 = (n: number) => String(n).padStart(2, '0');

// HH:MM:SS — live chart x-axis (rolling seconds window), in `timeZone`.
export const fmtTime = (ts: number) => {
  const d = zonedDate(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// HH:MM — historical chart x-axis (per-minute, full day), in `timeZone`.
export const fmtHourMinute = (ts: number) => {
  const d = zonedDate(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

// Weighting-independent identity of a series ('LAeq,1s' -> 'Leq,1s'), so the
// legend toggle state can be shared across the dB(A)/dB(C) switch.
export const seriesKind = (label: string) => label[0] + label.slice(2);

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
