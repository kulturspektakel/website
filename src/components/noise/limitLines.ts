import {isSeriesKey, type SeriesKey} from './series';

// A location's permitted level as a chart takes one: the series it is written against, the
// figure, and both bounds concrete, in epoch ms.
//
// Structural rather than NoiseLimit, and for the same reason AssignmentWindow is not
// NoiseAssignment: the two loaders that produce one reach it from different directions — a
// location's whole list, and whatever stands where a monitor does — and what a chart takes
// is neither of those rows. Both resolve through limitLine below, so the chart never has to
// know that a blank bound means the event's.
//
// The series is the whole of what makes a limit comparable with anything. A bare dB figure
// could be read against any line on the chart, and the answer would differ by ten decibels
// depending on which — an LAeq over a minute and an LCpeak are not the same measurement of
// the same evening. So a limit names one, and is drawn only where that one is.
export type LimitLine = {
  series: SeriesKey;
  decibels: number;
  start: number;
  end: number;
};

/**
 * A stored limit as a chart takes one: both bounds resolved against the event, and the
 * series narrowed to one the table knows.
 *
 * Here rather than in each loader because both of them — the project page's, which reads a
 * location's whole list, and the device page's, which reads whatever stands where that
 * monitor does — were spelling out the same two rules. A null bound is the edge of the
 * event, *both* ends of it: unlike a placement, whose open end means "still standing" and
 * cannot be resolved to an instant, a limit does not run on past the festival (see the
 * schema). So neither reader has to know that, and the two cannot come to disagree about
 * which midnight a blank means.
 *
 * Null for a row whose series the table no longer has — a limit with nothing to be drawn
 * against, dropped rather than carried to a colour lookup that misses. The column is text,
 * so this is also the one place it becomes a SeriesKey.
 */
export function limitLine(
  row: {series: string; decibels: number; start: Date | null; end: Date | null},
  project: {start: Date; end: Date},
): LimitLine | null {
  if (!isSeriesKey(row.series)) return null;
  return {
    series: row.series,
    decibels: row.decibels,
    start: (row.start ?? project.start).getTime(),
    end: (row.end ?? project.end).getTime(),
  };
}

// One drawable rule, in the units the plot works in: seconds along x, dB along y, already
// cut to what is on screen. `from`/`to` and not `start`/`end`, because these are no longer
// the limit's own bounds — they are where its line begins and ends on this chart.
export type LimitSegment = {
  series: SeriesKey;
  decibels: number;
  from: number;
  to: number;
};

/**
 * The limits worth drawing over a window, as the segments to stroke across it.
 *
 * Two filters, and they are the same kind of thing — what this window has nothing to say
 * about:
 *
 * `picked` drops a limit whose series is not on the chart. A rule the trace under it cannot
 * be read against is worse than no rule: it invites exactly the comparison it cannot
 * support, and on a chart showing LAeq a 130 dB peak limit reads as headroom that isn't
 * there. So a limit appears when its series does, which also means the header's menu is
 * what brings it into view — the same control that brings in the line it bounds.
 *
 * The window drops what is not on screen, cut to `[xMin, xMax]` here rather than by the
 * chart, which is what lets one call serve both modes: a location's crop is a window the
 * timeline picked and a device page's is the last few minutes off the clock, and neither
 * caller has to filter its own list.
 *
 * `[start, end)`, the reading every window in this section is given — assignmentsAt and
 * maskToWindows both — so a limit ending at 22:00 and the one starting there meet without a
 * moment belonging to both. A limit that ends exactly where the window starts is therefore
 * not in force over it and produces nothing.
 *
 * Several segments may cover one instant: limits are allowed to overlap (see the schema),
 * because which of two applies is for whoever reads them, so that is an ordinary answer here
 * and not a case to collapse.
 *
 * The dB is passed through untouched: this cuts along time, and where a figure outside the
 * chart's fixed axis ends up is the drawing's business rather than a second rule written
 * here (see drawLimits).
 */
export function limitSegments(
  limits: readonly LimitLine[],
  picked: readonly SeriesKey[],
  xMin: number,
  xMax: number,
): LimitSegment[] {
  const out: LimitSegment[] = [];
  for (const limit of limits) {
    if (!picked.includes(limit.series)) continue;
    // Out of milliseconds once, here at the edge, as everywhere this section hands a time
    // to uPlot.
    const start = limit.start / 1000;
    const end = limit.end / 1000;
    // Half-open at both comparisons: a limit is in force over the window only if it
    // begins before the window ends and ends after the window begins.
    if (start >= xMax || end <= xMin) continue;
    const from = Math.max(start, xMin);
    const to = Math.min(end, xMax);
    // A limit clipped to nothing at all — one whose window has zero width, which the
    // editor allows since it does not compare the two fields.
    if (to <= from) continue;
    out.push({
      series: limit.series,
      decibels: limit.decibels,
      from,
      to,
    });
  }
  return out;
}
