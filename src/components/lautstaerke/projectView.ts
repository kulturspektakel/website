import {createContext, useContext, useEffect} from 'react';
import type {loadNoiseProject} from '../../routes/crew.lautstaerke';
import type {LevelMetric} from './level';
import type {DeviceSeries, Weighting} from './noise';
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
 * `start` inclusive, `end` exclusive, so two abutting assignments never both match —
 * a monitor handed from one location to the next at 18:00 stood at the second one at
 * 18:00, not at both. Windows that meet exactly are the ordinary case and the reason
 * the rule has to be written down somewhere; overlappingAssignments below reads it
 * the same way.
 */
export function assignmentsAt(
  assignments: readonly NoiseAssignment[],
  at: number | null,
): NoiseAssignment[] {
  return assignments.filter((a) =>
    at == null ? a.end == null : a.start <= at && (a.end == null || a.end > at),
  );
}

// One monitor's line on a location's chart: who it is, the stretches of the event its
// readings belong to this place, and when the monitor itself was last heard from — which
// is the device's own property, so any of its rows carries it. Open-ended windows mean
// it is still standing here.
export type DeviceWindows = {
  deviceId: string;
  lastSeen: number | null;
  windows: Array<{start: number; end: number | null}>;
};

/**
 * A location's chart, as a list of lines — which is what makes it a chart of the *place*
 * rather than of whatever monitors happen to be standing there now.
 *
 * A monitor's stored trace covers the whole event wherever it stood, so plotting it whole
 * under a location would draw the noise of every other stage it visited. Each line is
 * therefore clipped to the windows this location had that monitor for (see maskToWindows),
 * and consecutive placements of different monitors read as one continuous trace of the
 * place — which is the thing anyone looking at a location actually wants.
 *
 * One line per monitor, not per assignment: a monitor carried away and brought back is
 * still the same monitor, and its two stints are one line with a gap in it. Two monitors
 * standing here at once are two lines, which is the case the envelope underneath exists
 * for.
 *
 * Ordered by when the location first had each monitor, so the lines are in the order the
 * event happened.
 */
export function locationLines(
  assignments: readonly NoiseAssignment[],
): DeviceWindows[] {
  const byDevice = new Map<string, DeviceWindows>();
  for (const a of [...assignments].sort((x, y) => x.start - y.start)) {
    const line = byDevice.get(a.deviceId);
    if (line) line.windows.push({start: a.start, end: a.end});
    else
      byDevice.set(a.deviceId, {
        deviceId: a.deviceId,
        lastSeen: a.lastSeen,
        windows: [{start: a.start, end: a.end}],
      });
  }
  return [...byDevice.values()];
}

// The part of an assignment a clash is decided on. Structural rather than
// NoiseAssignment itself, because the dialog compares rows that are still drafts: its
// unsaved lines have a local key for an id and no device to have last been seen.
export type AssignmentWindow = {
  id: string;
  deviceId: string;
  start: number;
  end: number | null;
};

// A window together with where it was, which is the whole of what a conflict has to
// say: the row it clashes with may be at a location the dialog isn't showing.
export type AssignmentConflict = {
  locationName: string;
  assignment: AssignmentWindow;
};

/**
 * What a row clashes with — the warning under a line in the assignments dialog.
 *
 * Two kinds count, and they are different questions. Two monitors at *this* location
 * over the same minutes is a claim about the place, and probably a mistyped handover.
 * The *same* monitor at two locations over the same minutes is a claim about the
 * device, and cannot be true wherever it is recorded — that one used to be impossible,
 * because assigning a device closed its open row, and the dialog that lets a window be
 * typed by hand trades that silent rewrite for this warning.
 *
 * `[start, end)` as everywhere else, so abutting windows do not clash. An open end runs
 * forever rather than to the project's end: two open rows for one monitor are a
 * contradiction whether or not the festival is over.
 *
 * Only the later of two rows *at this location* is told — a warning printed twice says
 * no more than once and turns one mistake into two red triangles. Every row here is on
 * screen and editable, including the ones not saved yet, so the later one is always
 * something the reader can act on. A row at another location is not on screen to carry
 * the warning, so those are reported whichever way round they fall.
 */
export function overlappingAssignments(
  row: AssignmentWindow,
  locationId: string,
  locations: readonly {
    id: string;
    locationName: string;
    assignments: readonly AssignmentWindow[];
  }[],
): AssignmentConflict[] {
  const conflicts: AssignmentConflict[] = [];
  for (const location of locations) {
    const here = location.id === locationId;
    for (const other of location.assignments) {
      if (other.id === row.id) continue;
      if (!here && other.deviceId !== row.deviceId) continue;
      if (!overlaps(row, other)) continue;
      // Ties broken by id so that two rows starting at the same instant still warn
      // once rather than either twice or not at all.
      if (
        here &&
        (other.start > row.start ||
          (other.start === row.start && other.id > row.id))
      ) {
        continue;
      }
      conflicts.push({locationName: location.locationName, assignment: other});
    }
  }
  return conflicts;
}

// A window with no end never closes; one whose end is at or before its start — which a
// half-corrected row can be — covers no instant at all, and so clashes with nothing.
function overlaps(
  a: {start: number; end: number | null},
  b: {start: number; end: number | null},
): boolean {
  const aEnd = a.end ?? Infinity;
  const bEnd = b.end ?? Infinity;
  if (aEnd <= a.start || bEnd <= b.start) return false;
  return a.start < bEnd && b.start < aEnd;
}

// One location and the monitors that stood there at the instant the page is looking
// at, resolved by the layout rather than by each view — see `locations` below.
export type ResolvedLocation = {
  location: NoiseLocationItem;
  assignments: NoiseAssignment[];
};

// The map and the list are sibling routes under the $projectId layout, which owns
// everything they have in common: the project itself (a query, so an assignment
// made in either view is picked up by both), the live/scrub toggle, the selected
// timeframe, and everything read off the project's logs. Share it through this
// context so switching views neither refetches the project nor resets the timeline —
// the same reason the $device layout shares its weighting toggle (see deviceView.ts).
//
// Everything here holds still while the pointer travels over a row chart. What moves
// with the playhead is in the two contexts below, and it is split off precisely because
// this one is read by every card on the page: a value that changed sixty times a second
// would re-render all of them, ⋮ menu and monitor names included, for a line the
// charts move with one style write.
//
// It does not hold still through a timeline drag — `range` and `totals` both change, so
// that gesture does re-render every card. The quarter-hour snap on the thumbs is what
// keeps that affordable; the split protects the hover, not both gestures.
export type ProjectViewCtx = {
  project: NoiseProject;
  live: boolean;
  // The timeline's crop in epoch ms, already clamped into the project. The playhead
  // inside it is not here — see above.
  range: {start: number; end: number};
  // The whole of the project a crop may cover: the event's own window, never past the
  // current time (see visibleProjectWindow), which is what every gesture is clamped to.
  // `range` is the part of it on screen. Here rather than derived per view because the
  // right edge follows the clock during a running festival, and the timeline and the
  // charts must not answer differently about where the strip ends.
  bounds: {start: number; end: number};
  // Every location with the monitors that stood there at the instant being viewed.
  // Resolved once by the layout, for two reasons: the map and the list would otherwise
  // each apply assignmentsAt themselves (two places to get the rule wrong), and the
  // answer only changes when an assignment starts or ends — so pinning its identity
  // here is what keeps a scrub out of the cards entirely.
  locations: ResolvedLocation[];
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
  // map and the list can't drift apart, and it resolves `totals`/`traces` against it
  // — the views need them only for the live path.
  metric: LevelMetric;
  weighting: Weighting;
  // Each *location's* Leq over the crop — the energetic mean of its per-minute
  // loudest, which is the number every card leads with whatever the picker says, and
  // the average of the very area its chart fills (see locationEnergyIndex). Keyed by
  // location and not by device on purpose: a monitor's own history spans every stage it
  // visited, so a per-device figure printed the same number on every card it had ever
  // stood at. Absent while live, and while the one query behind it is in flight.
  locationTotals?: Record<string, RangeTotals>;
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

/**
 * The playhead, as something to subscribe to rather than to render.
 *
 * A plain closure and not a hook: the layout keeps one for its lifetime and pushes the
 * instant in from an effect, so the identity every chart's subscription depends on can
 * never change. Same shape and same reason as the sample buffers in context.tsx — what
 * reads this moves a div, and re-rendering it sixty times a second to hand over a
 * number it only writes into a ref would cost more than the moving does.
 *
 * The listener is called once on registration and then on every change, so a chart that
 * mounts while the playhead already stands somewhere needs no separate first call.
 */
export type PlayheadSignal = (
  listener: (at: number | null) => void,
) => () => void;

export function createPlayheadSignal() {
  let at: number | null = null;
  const listeners = new Set<(at: number | null) => void>();
  return {
    set(next: number | null) {
      if (next === at) return;
      at = next;
      for (const listener of listeners) listener(at);
    },
    subscribe(listener: (at: number | null) => void) {
      listener(at);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

// A chart with nobody moving its playhead: the line simply never appears. Honours the
// call-on-registration contract rather than doing nothing at all, so a subscriber
// outside a project page is told there is no instant instead of being left with
// whatever it started with.
const NO_PLAYHEAD: PlayheadSignal = (listener) => {
  listener(null);
  return () => {};
};

/**
 * Where the playhead stands, and what every monitor read there — two contexts, because
 * the two change at rates that differ by a factor of sixty.
 *
 * The signal never changes for the life of the layout, so what subscribes to it never
 * re-renders. That is the whole point: the line down each row chart is a DOM node the
 * chart moves with one `transform`, and bundling the signal in with the values would
 * re-render every open chart on every animation frame of a hover to deliver it — which
 * is exactly what drawing the line in the DOM rather than the canvas exists to avoid.
 * (React re-renders a useContext consumer when the provider's value changes, whichever
 * field it went on to read.)
 *
 * The readings do change with the playhead, but only when it crosses into a new stored
 * minute — see useProjectLogs — and only the two things that print an instant read
 * them: the numbers beside a location's name, and the map pins.
 */
export const PlayheadSignalContext = createContext<PlayheadSignal>(NO_PLAYHEAD);

// Absent while live, and while the project's logs are still loading — so `undefined` is
// an ordinary answer here and there is nothing for a hook to throw about.
export const PlayheadLevelsContext = createContext<
  Record<string, number> | undefined
>(undefined);

export const usePlayheadLevels = () => useContext(PlayheadLevelsContext);

/**
 * Run `move` whenever the playhead does, without rendering for it.
 *
 * `move` must be stable, which together with the signal's own stability is what keeps
 * this from re-subscribing — or re-rendering — as the instant changes.
 */
export function usePlayheadEffect(move: (at: number | null) => void) {
  const subscribe = useContext(PlayheadSignalContext);
  useEffect(() => subscribe(move), [subscribe, move]);
}
