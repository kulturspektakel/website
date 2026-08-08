import {createContext, useContext} from 'react';
import type {loadNoiseProject} from '../../routes/crew.lautstaerke';
import type {LevelMetric} from './level';
import type {DeviceSeries, Weighting} from './noise';
import type {ProjectSelection} from './projectSelection';
import type {RangeTotals} from './projectLogs';

export type NoiseProject = Awaited<ReturnType<typeof loadNoiseProject>>;
export type NoiseLocationItem = NoiseProject['locations'][number];
export type NoiseAssignment = NoiseLocationItem['assignments'][number];

/**
 * Which monitors stood at a location at one instant — `at: null` (live mode) meaning
 * the ones standing there now.
 *
 * The loader ships a location's whole assignment history, so this is what decides
 * what a pin or a row shows: scrubbing back through a project reads the monitor that
 * actually stood there then, rather than pinning that instant's levels at the
 * locations devices occupy today. The rule used to live in SQL, in the per-instant
 * query this replaced.
 *
 * `start` inclusive, `end` exclusive, so two abutting assignments never both match:
 * assignNoiseDevice closes the old row and opens the new one with one shared `now`
 * precisely so their windows meet exactly.
 */
export function assignmentsAt(
  assignments: readonly NoiseAssignment[],
  at: number | null,
): NoiseAssignment[] {
  return assignments.filter((a) =>
    at == null ? a.end == null : a.start <= at && (a.end == null || a.end > at),
  );
}

// The map and the list are sibling routes under the $projectId layout, which owns
// everything they have in common: the project itself (a query, so an assignment
// made in either view is picked up by both), the live/scrub toggle, the selected
// timeframe, and everything read off the project's logs. Share it through this
// context so switching views neither refetches the project nor resets the timeline —
// the same reason the $device layout shares its weighting toggle (see deviceView.ts).
export type ProjectViewCtx = {
  project: NoiseProject;
  live: boolean;
  // The timeline's crop and playhead in epoch ms, already clamped into the project.
  // The views need `current` as well as the ends: it decides which assignment — and
  // so which device — each location shows.
  selection: ProjectSelection;
  // The instant the page is looking at, or null for "whatever is standing there now"
  // — which is what assignmentsAt wants. Derived from `live` and the playhead by the
  // layout, so both views resolve a location's monitors the same way.
  viewedAt: number | null;
  // Moves the playhead — and only the playhead — to an instant, which is what a row
  // chart reports as the pointer travels over it. The crop stays where it was, so
  // hovering reads the project rather than re-picking it. Not called while live: there
  // is no instant to point at then, and the views withhold it.
  scrubTo: (at: number) => void;
  // Crops the timeframe, exactly where asked — what a row chart commits, whether that
  // came from the in/out keys (one end) or a drag across the trace (both). An omitted
  // end stays where it was; the playhead follows only if the crop leaves it outside.
  cropTo: (crop: {start?: number; end?: number}) => void;
  // What the header's two dropdowns are set to: which Leq window and which frequency
  // weighting every pin and row on the page shows. The layout owns the choice so the
  // map and the list can't drift apart, and it resolves `levels`/`traces` against it
  // — the views need them only for the live path.
  metric: LevelMetric;
  weighting: Weighting;
  // Read off the project's logs, so both views show the same number for the same
  // monitor. Absent while live, and while the one query behind them is in flight.
  // `levels` is the picked window at the playhead — the pins' number and the
  // coloured one on a row; `totals` is each monitor's Leq over the crop, which every
  // row leads with whatever the picker says.
  levels?: Record<string, number>;
  totals?: Record<string, RangeTotals>;
  // Whole-project traces at stored resolution; the crop is applied by the chart, not
  // here, so these survive a timeline drag untouched.
  traces?: Record<string, DeviceSeries>;
  // Re-reads what an assignment change invalidates. Lives on the layout because
  // it also invalidates lists rendered outside this route.
  refresh: () => Promise<void>;
};

export const ProjectViewContext = createContext<ProjectViewCtx | null>(null);

export function useProjectView() {
  const ctx = useContext(ProjectViewContext);
  if (!ctx) {
    throw new Error('useProjectView must be used within the $projectId layout');
  }
  return ctx;
}
