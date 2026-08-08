import {notFound} from '@tanstack/react-router';
import {Prisma} from '../generated/prisma/client';
import {prismaClient} from './prismaClient.server';
import {
  decodeDb,
  logMinuteIndex,
  type DeviceLocationRecord,
  type HistoryRow,
  type LevelColumn,
  type LogGrid,
  type ProjectLogs,
} from '../components/lautstaerke/noise';
import {visibleProjectWindow} from '../components/lautstaerke/projectSelection';
import {
  MAX_RANGE_DAYS,
  MAX_RANGE_MS,
  MINUTE_MS,
} from '../components/lautstaerke/timeframe';

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

// NoiseLog already holds one 60-second aggregate per row (measuredAt = the start
// of that minute), and every level — the 1m Leq, the device's trailing 5m/30m
// windows, and the max/peak values — is stored per row. So this is a straight
// per-row decode for one device over the requested UTC range: no aggregation and
// deliberately no downsampling, since each row is already the minute. Stored ints
// are encoded as (dB - 20) * 2, so dB = 20 + val/2; the 5m/30m columns are null
// until the device's buffer has filled (and for rows ingested before those
// columns existed), which decodes to null and simply leaves a gap in that line.
//
// The WHERE clause is a single range scan on the @@unique([deviceId, measuredAt])
// index (~1440 rows/day), so this stays cheap for the ranges MAX_RANGE_MS allows.
export async function noiseHistory(
  deviceId: string,
  start: Date,
  end: Date,
): Promise<HistoryRow[]> {
  // Backstop only: parseRangeSearch already rejects over-cap ranges at every
  // entry point, so reaching this means a caller bypassed it.
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new Error(`noiseHistory: range exceeds ${MAX_RANGE_DAYS} days`);
  }
  return prismaClient.$queryRaw<HistoryRow[]>`
    SELECT
      extract(epoch FROM "measuredAt")::float8 AS minute_epoch,
      (20 + laeq / 2.0)::float8 AS laeq_1m,
      (20 + lceq / 2.0)::float8 AS lceq_1m,
      (20 + laeq5m / 2.0)::float8 AS laeq_5m,
      (20 + lceq5m / 2.0)::float8 AS lceq_5m,
      (20 + laeq30m / 2.0)::float8 AS laeq_30m,
      (20 + lceq30m / 2.0)::float8 AS lceq_30m,
      (20 + lafmax / 2.0)::float8 AS lafmax,
      (20 + lcfmax / 2.0)::float8 AS lcfmax,
      (20 + lcpeak / 2.0)::float8 AS lcpeak
    FROM "NoiseLog"
    WHERE "deviceId" = ${deviceId}
      AND "measuredAt" >= ${start}
      AND "measuredAt" < ${end}
    ORDER BY "measuredAt"
  `;
}

// A device's full location history (few rows), oldest first. The label shown for
// a given day is resolved client-side from this (see resolveLocation) since a
// device can be relocated over time.
export async function deviceLocations(
  deviceId: string,
): Promise<DeviceLocationRecord[]> {
  const rows = await prismaClient.deviceLocation.findMany({
    where: {deviceId},
    orderBy: {createdAt: 'asc'},
    select: {locationName: true, createdAt: true},
  });
  return rows.map((r) => ({
    name: r.locationName,
    createdAt: r.createdAt.getTime(),
  }));
}

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
      from: new Date(Math.max(a.start.getTime(), start)),
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
