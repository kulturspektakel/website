import {notFound} from '@tanstack/react-router';
import {Prisma} from '../generated/prisma/client';
import {prismaClient} from './prismaClient.server';
import {
  decodeDb,
  logMinuteIndex,
  type DeviceAssignment,
  type LevelColumn,
  type LogGrid,
  type ProjectLogs,
} from '../components/lautstaerke/noise';
import {visibleProjectWindow} from '../components/lautstaerke/projectSelection';
import {MINUTE_MS} from '../components/lautstaerke/timeframe';

// The displayable levels, as the wire names them against the Prisma field each comes
// from. One table rather than the same names spelled out in the select, the
// initializer and the fill: adding one is one row here, and the reader resolves the
// same names through the series table (see logColumn).
//
// Every series the picker offers, not just the Leq windows: the maxima are what one
// checks a limit against, so a page that can plot them has to be shipped them.
const LOG_COLUMNS = [
  ['laeq_1m', 'laeq'],
  ['lceq_1m', 'lceq'],
  ['laeq_5m', 'laeq5m'],
  ['lceq_5m', 'lceq5m'],
  ['laeq_30m', 'laeq30m'],
  ['lceq_30m', 'lceq30m'],
  ['lafmax', 'lafmax'],
  ['lcfmax', 'lcfmax'],
  ['lcpeak', 'lcpeak'],
] as const satisfies ReadonlyArray<readonly [LevelColumn, LevelField]>;

// The Prisma fields the table above may name. Spelling them again as a select is
// unavoidable — Prisma infers the row type from a literal, so a computed select would
// hand back untyped rows — but `satisfies` keys both against this one union, so a
// missing or misspelt field is a compile error rather than a column of nulls.
type LevelField =
  | 'laeq'
  | 'lceq'
  | 'laeq5m'
  | 'lceq5m'
  | 'laeq30m'
  | 'lceq30m'
  | 'lafmax'
  | 'lcfmax'
  | 'lcpeak';

const LEVEL_SELECT = {
  laeq: true,
  lceq: true,
  laeq5m: true,
  lceq5m: true,
  laeq30m: true,
  lceq30m: true,
  lafmax: true,
  lcfmax: true,
  lcpeak: true,
} as const satisfies Record<LevelField, true> & Prisma.NoiseLogSelect;

// What one project may hand to the browser, in device-minutes actually deployed. A
// festival is a fortnight at the outside and fifteen monitors is a lot of them, which
// is ~300k — so this is generous headroom that still fails loudly rather than trying
// to serialise a decade. Projects are created by hand, so exceeding it means a typo
// in a date, not a real event.
const MAX_PROJECT_LOG_MINUTES = 200_000;

/**
 * Where a monitor is standing *right now*, or null if it is standing nowhere.
 *
 * "Assigned" is a row, not a field: NoiseLocationAssignment carries [start, end) per device
 * per location. So the question is which of a monitor's rows covers this instant, and both
 * halves of that need saying:
 *
 *   started — its own `start` if it has one, and otherwise the event's: a placement typed in
 *             for tomorrow is not where the monitor is today, and one left blank means "from
 *             the beginning", whenever the beginning turns out to be.
 *   not over — its own `end` if it has one, and otherwise the event's. An open row means
 *              "still there" only for as long as there is an event to be there for: a
 *              festival that finished in July does not leave a monitor standing at a stage
 *              that no longer exists, however the row was left.
 *
 * Both bounds fall back to the project's, which is the whole reason it is joined rather than
 * just named: a placement is bounded by the thing it belongs to, and nothing else knows where
 * those boundaries are. It is also why the columns are nullable — see the schema: an event
 * whose dates move takes its placements with it.
 *
 * Deliberately *not* the same test as assignableNoiseDevices, which asks whether a monitor
 * has an open row *anywhere* — a stricter question, and the right one there: an open row
 * left behind by a finished festival should be closed rather than quietly written over with
 * a second one. So a monitor can read as free to place and still be standing nowhere, which
 * is exactly the state a forgotten row leaves it in.
 *
 * One row taken, latest start first, blanks last — a blank start is the event's own, so it is
 * the earliest a placement can begin and the least specific claim on this instant. A monitor
 * can carry two that overlap: the assignments dialog permits the mistake and warns about it
 * rather than preventing it (see overlappingAssignments), because a contradiction somebody
 * typed is theirs to resolve. Where there is one, the most recently started is the likeliest
 * truth.
 */
export async function deviceAssignment(
  deviceId: string,
): Promise<DeviceAssignment | null> {
  const row = await prismaClient.noiseLocationAssignment.findFirst({
    where: {deviceId, ...currentAssignmentWhere(new Date())},
    orderBy: CURRENT_ASSIGNMENT_ORDER,
    select: CURRENT_ASSIGNMENT_SELECT,
  });
  return row ? toDeviceAssignment(row) : null;
}

/**
 * The same question of every monitor at once — what the device list on the section's
 * landing page reads, where a row per device would be a query per device. See
 * deviceAssignment above for why a placement is a row and what its blank bounds mean;
 * this only differs in three ways.
 *
 * One `now` for the whole set, so no two rows of the list can be resolved against
 * different instants — a monitor whose placement ends this second must not be able to
 * show up as both placed and not, depending on where in the list it fell.
 *
 * Keyed by device, first row per device wins, which is `findFirst` with the same
 * ordering: latest start first, blanks last. Where a monitor carries two overlapping
 * placements — permitted, and warned about rather than prevented (see
 * overlappingAssignments) — both genuinely cover this instant, and the most recently
 * started is the likeliest truth.
 *
 * Absent from the map rather than null, so a device with no placement is one the caller
 * doesn't find. Only monitors that have one appear at all.
 */
export async function deviceAssignments(): Promise<
  Map<string, DeviceAssignment>
> {
  const rows = await prismaClient.noiseLocationAssignment.findMany({
    where: currentAssignmentWhere(new Date()),
    orderBy: CURRENT_ASSIGNMENT_ORDER,
    select: {deviceId: true, ...CURRENT_ASSIGNMENT_SELECT},
  });
  const assignments = new Map<string, DeviceAssignment>();
  for (const row of rows) {
    // Not `set` unconditionally: the order above puts the likeliest first, so the
    // second row of an overlapping pair must not overwrite it.
    if (!assignments.has(row.deviceId)) {
      assignments.set(row.deviceId, toDeviceAssignment(row));
    }
  }
  return assignments;
}

// The instant test both of the above ask, shared so that "is this monitor standing
// here now" cannot come to mean two different things depending on how many devices
// were asked about. One clause per bound, each "the row's own, or the event's where it
// has none". Two ORs, so they are spelled as an AND of them rather than merged — a
// single OR list would read as "either bound holds", which is not the question.
const currentAssignmentWhere = (
  now: Date,
): Prisma.NoiseLocationAssignmentWhereInput => ({
  AND: [
    {
      OR: [
        {start: {lte: now}},
        {start: null, NoiseLocation: {NoiseProject: {start: {lte: now}}}},
      ],
    },
    {
      OR: [
        {end: {gt: now}},
        {end: null, NoiseLocation: {NoiseProject: {end: {gt: now}}}},
      ],
    },
  ],
});

// Latest start first, blanks last — a blank start is the event's own, so it is the
// earliest a placement can begin and the least specific claim on this instant.
const CURRENT_ASSIGNMENT_ORDER = {
  start: {sort: 'desc', nulls: 'last'},
} as const satisfies Prisma.NoiseLocationAssignmentOrderByWithRelationInput;

// A placement names both the spot and the festival it is a spot at, which is what
// makes it worth showing (see DeviceAssignment).
const CURRENT_ASSIGNMENT_SELECT = {
  NoiseLocation: {
    select: {
      id: true,
      locationName: true,
      projectId: true,
      NoiseProject: {select: {name: true}},
    },
  },
} as const satisfies Prisma.NoiseLocationAssignmentSelect;

const toDeviceAssignment = (row: {
  NoiseLocation: {
    id: string;
    locationName: string;
    projectId: string;
    NoiseProject: {name: string};
  };
}): DeviceAssignment => ({
  locationId: row.NoiseLocation.id,
  locationName: row.NoiseLocation.locationName,
  projectId: row.NoiseLocation.projectId,
  projectName: row.NoiseLocation.NoiseProject.name,
});

// Every stored level of one project, as one minute-indexed column per device per
// weighting — the single payload the project page reads when live mode is off. It
// replaced three per-view queries (an instant, a range aggregate, a bucketed trace),
// because all three were slices of this and the browser can slice it itself.
//
// Two windows bound what is read, and both matter:
//
//   the project's own, capped at now — there are no measurements in the future, and
//   the page cannot select past that edge either (see visibleProjectWindow);
//
//   each assignment's, so a monitor contributes only the minutes it actually stood
//   somewhere in this project. Without that clip a device deployed for an afternoon
//   would carry four days of levels it measured elsewhere, and the row chart and the
//   Beginn–Ende Leq would both take them at face value.
//
// The clip is expressed as one OR branch per assignment, which keeps every branch an
// index scan on @@unique([deviceId, measuredAt]) and means Postgres never reads a
// minute the page cannot show. A project holds a handful of assignments, so the
// branch list stays short.
export async function projectLogs(projectId: string): Promise<ProjectLogs> {
  // The assignments come along with the project rather than in a second round trip:
  // the overlap filter below needs the window this query resolves, and a project holds
  // few enough assignments to filter in memory.
  const project = await prismaClient.noiseProject.findUnique({
    where: {id: projectId},
    select: {
      start: true,
      end: true,
      NoiseLocation: {
        select: {
          NoiseLocationAssignment: {
            select: {deviceId: true, start: true, end: true},
          },
        },
      },
    },
  });
  if (!project) throw notFound();

  // The same window the page clamps its selection to, so the payload covers exactly
  // what can be asked for and no more.
  const grid: LogGrid = {start: project.start.getTime(), stepMs: MINUTE_MS};
  const {start, end} = visibleProjectWindow(
    {start: grid.start, end: project.end.getTime()},
    Date.now(),
  );
  const minutes = Math.ceil((end - start) / MINUTE_MS);

  // Each assignment intersected with the window — and only those that overlap it at
  // all: one that closed before the project's window began can never be displayed,
  // since the page only ever asks about instants inside it.
  //
  // Deployed minutes rather than devices × window, so a monitor that stood there for
  // an afternoon costs an afternoon, which is also what the cap below measures.
  const spans = project.NoiseLocation.flatMap((l) =>
    l.NoiseLocationAssignment.map((a) => ({
      deviceId: a.deviceId,
      // A null start is the event's own, and `start` is already the event's start (capped
      // at now), so the clamp below is the whole of what resolving it takes.
      from: new Date(Math.max(a.start?.getTime() ?? start, start)),
      to: new Date(Math.min(a.end?.getTime() ?? end, end)),
    })),
  ).filter((s) => s.to > s.from);
  if (spans.length === 0 || minutes <= 0) {
    return {...grid, minutes: Math.max(0, minutes), devices: {}};
  }

  const deployedMinutes = spans.reduce(
    (sum, s) =>
      sum + Math.max(0, (s.to.getTime() - s.from.getTime()) / MINUTE_MS),
    0,
  );
  if (deployedMinutes > MAX_PROJECT_LOG_MINUTES) {
    throw new Error(
      `projectLogs: ${Math.round(deployedMinutes)} device-minutes exceeds ${MAX_PROJECT_LOG_MINUTES}`,
    );
  }

  const rows = await prismaClient.noiseLog.findMany({
    where: {
      OR: spans.map((s) => ({
        deviceId: s.deviceId,
        measuredAt: {gte: s.from, lt: s.to},
      })),
    },
    select: {
      deviceId: true,
      measuredAt: true,
      ...LEVEL_SELECT,
    },
  });

  // One column per displayable window, filled by index. Every window travels, so the
  // page's weighting and window pickers change what is shown without another request.
  const devices: Record<string, Record<LevelColumn, (number | null)[]>> = {};
  for (const row of rows) {
    const at = logMinuteIndex(grid, row.measuredAt.getTime());
    if (at < 0 || at >= minutes) continue;
    const device = (devices[row.deviceId] ??= Object.fromEntries(
      LOG_COLUMNS.map(([column]) => [column, new Array(minutes).fill(null)]),
    ) as Record<LevelColumn, (number | null)[]>);
    for (const [column, field] of LOG_COLUMNS) {
      const stored = row[field];
      // Null on the 5m/30m fields until the device's rolling buffer filled — a window
      // it cannot yet report, which reads as no level rather than as a zero.
      if (stored != null) device[column][at] = decodeDb(stored);
    }
  }

  return {
    ...grid,
    minutes,
    // A column that stayed null throughout is dropped rather than shipped: the 30m
    // windows of a short event, and anything predating those columns, would otherwise
    // be thousands of nulls per device. An absent column reads as "no value" already.
    devices: Object.fromEntries(
      Object.entries(devices).map(([deviceId, columns]) => [
        deviceId,
        Object.fromEntries(
          Object.entries(columns).filter(([, values]) =>
            values.some((v) => v != null),
          ),
        ),
      ]),
    ),
  };
}
