import {
  createFileRoute,
  notFound,
  Outlet,
  useBlocker,
} from '@tanstack/react-router';
import {Box} from '@chakra-ui/react';
import {z} from 'zod';
import {useRef} from 'react';
import 'uplot/dist/uPlot.min.css';
import {seo} from '../utils/seo';
import {
  BluetoothContext,
  NoiseBuffersContext,
  NoiseLiveContext,
} from '../components/lautstaerke/context';
import {useNoiseStream} from '../components/lautstaerke/useNoiseStream';
import {useBleDevice} from '../components/lautstaerke/useBleDevice';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {prismaClient} from '../server/prismaClient.server';
import {deviceAssignments, projectLogs} from '../server/noiseHistory.server';
import {Toaster} from '../components/chakra-snippets/toaster';
import {END_BEFORE_START} from '../components/lautstaerke/timeframe';

// The section's data layer lives in this layout file and is imported by the leaf
// routes, as in crew.produkte.tsx. Every DateTime crosses the wire as epoch ms
// (like deviceLastSeen and HistoryData) and comes back in as an ISO string (like
// the ?start/?end search params), so no Date ever has to survive serialization.

export const listNoiseProjects = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    // Newest festival first — that's the one you're almost always after.
    const projects = await prismaClient.noiseProject.findMany({
      orderBy: [{start: 'desc'}, {name: 'asc'}],
      select: {
        id: true,
        name: true,
        start: true,
        end: true,
        _count: {select: {NoiseLocation: true}},
      },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      start: p.start.getTime(),
      end: p.end.getTime(),
      locationCount: p._count.NoiseLocation,
    }));
  });

const isoInstant = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum');

// Exported because the create dialogs validate the same field client-side; the
// length cap and the message must not be able to drift apart, or an over-long
// name becomes a server rejection with nothing to attach it to.
export const noiseName = z.string().trim().min(1, 'Name erforderlich').max(60);

export const createNoiseProjectInput = z
  .object({
    name: noiseName,
    start: isoInstant,
    end: isoInstant,
  })
  .refine((v) => Date.parse(v.end) > Date.parse(v.start), {
    message: END_BEFORE_START,
    path: ['end'],
  });

export const createNoiseProject = createServerFn()
  .middleware([crewAuth])
  .inputValidator(createNoiseProjectInput)
  .handler(async ({data}) =>
    // Returns the id so the dialog can drop the user straight into the project
    // they just created (which is why they created it).
    prismaClient.noiseProject.create({
      data: {
        name: data.name,
        start: new Date(data.start),
        end: new Date(data.end),
      },
      select: {id: true},
    }),
  );

export const loadNoiseProject = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({projectId: z.string().min(1)}))
  .handler(async ({data}) => {
    const project = await prismaClient.noiseProject.findUnique({
      where: {id: data.projectId},
      select: {
        id: true,
        name: true,
        start: true,
        end: true,
        // Unordered on purpose: what order locations are shown in is decided in one
        // place, and it isn't here (see compareLocations). Postgres would sort
        // `Bühne 10` before `Bühne 2`, and a second opinion in the query is a second
        // thing to keep in step with the first.
        NoiseLocation: {
          select: {
            id: true,
            locationName: true,
            latitude: true,
            longitude: true,
            // The whole history, not just the open rows: which monitor stood here is
            // a question the page asks about the instant it is showing, and it
            // resolves that client-side (see assignmentsAt). `end == null` still
            // means "standing here right now", which is what live mode reads.
            //
            // Deliberately not filtered to the project's window either. Out-of-window
            // rows never match an in-window instant, and one case needs them: a device
            // assigned after a finished project's end has an open assignment starting
            // past the window, and live mode must still show it standing there.
            NoiseLocationAssignment: {
              orderBy: {start: 'asc'},
              select: {
                id: true,
                deviceId: true,
                start: true,
                end: true,
                Device: {select: {lastSeen: true}},
              },
            },
          },
        },
      },
    });
    if (!project) throw notFound();
    return {
      id: project.id,
      name: project.name,
      start: project.start.getTime(),
      end: project.end.getTime(),
      // Browser-key for the Maps JS API, shipped to the client the same way the
      // booking detail route does it.
      apiKey: process.env.GOOGLE_MAPS_API_KEY ?? null,
      locations: project.NoiseLocation.map((l) => ({
        id: l.id,
        locationName: l.locationName,
        latitude: l.latitude,
        longitude: l.longitude,
        assignments: l.NoiseLocationAssignment.map((a) => ({
          id: a.id,
          deviceId: a.deviceId,
          // Resolved here and nowhere else: a null start means the event's own (see the
          // schema), and every reader of a placement's window wants an instant — the
          // charts' clipping, assignmentsAt, the overlap warnings. This is the one place
          // that has both the row and the project in hand, so it is the one place that
          // has to know.
          start: a.start?.getTime() ?? project.start.getTime(),
          // Whether that came from the row or from the event, which the resolved number
          // above cannot say. Only the assignments dialog asks: a blank field is what
          // "from the beginning, whenever that turns out to be" looks like, and writing
          // the resolved instant back would pin a placement that was meant to follow.
          startsWithProject: a.start == null,
          // Null means still standing there; every other field is epoch ms, as
          // everything that crosses this wire is.
          end: a.end?.getTime() ?? null,
          lastSeen: a.Device.lastSeen?.getTime() ?? null,
        })),
      })),
    };
  });

// Coordinates are plain numbers, never z.coerce.number(): Number('') is 0, so a
// coercing schema would turn an empty field into a valid point off West Africa.
// The dialog validates its strings first and only then converts.
export const createNoiseLocationInput = z.object({
  projectId: z.string().min(1),
  locationName: noiseName,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createNoiseLocation = createServerFn()
  .middleware([crewAuth])
  .inputValidator(createNoiseLocationInput)
  .handler(async ({data}) => {
    // The FK would reject an unknown project anyway, but a 404 is the honest
    // answer for a stale page.
    const project = await prismaClient.noiseProject.findUnique({
      where: {id: data.projectId},
      select: {id: true},
    });
    if (!project) throw notFound();
    return prismaClient.noiseLocation.create({data, select: {id: true}});
  });

// Every stored level of one project, in one payload: the page then answers its own
// questions locally (see projectLogs.ts). No window and no weighting in the input —
// the whole event travels, so scrubbing, cropping and the header's pickers never
// come back here. Only sent when live mode is off.
export const noiseProjectLogs = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({projectId: z.string().min(1)}))
  .handler(async ({data}) => projectLogs(data.projectId));

export const assignableNoiseDevices = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    const devices = await prismaClient.device.findMany({
      // A monitor hangs in one place at a time, so "available" means it has no
      // open assignment anywhere — including in another project.
      where: {
        type: 'NOISE_MONITOR',
        NoiseLocationAssignment: {none: {end: null}},
      },
      orderBy: {id: 'asc'},
      select: {id: true, lastSeen: true},
    });
    return devices.map((d) => ({
      id: d.id,
      lastSeen: d.lastSeen?.getTime() ?? null,
    }));
  });

// Every monitor there is, assigned or not — what the landing page lists and what the
// assignments dialog picks from. Deliberately not `assignableNoiseDevices`: recording a
// placement that has already ended is half of what that dialog is for, and the device
// standing somewhere today is usually the one whose past you are correcting.
//
// Where each one is standing rides along, because that is most of what a list of
// monitors is read for — "which of these is at the Hauptbühne" is the question, and a
// list that made you open every device page to answer it would not be worth having. One
// extra findMany for the whole set (see deviceAssignments), so the two pickers pay a
// small join they then ignore rather than this being split into two near-identical
// server functions that both have to be kept in step.
export const noiseMonitorDevices = createServerFn()
  .middleware([crewAuth])
  .handler(async () => {
    const [devices, assignments] = await Promise.all([
      prismaClient.device.findMany({
        where: {type: 'NOISE_MONITOR'},
        orderBy: {id: 'asc'},
        select: {id: true, lastSeen: true},
      }),
      deviceAssignments(),
    ]);
    return devices.map((d) => ({
      id: d.id,
      lastSeen: d.lastSeen?.getTime() ?? null,
      // Null for a monitor in a cupboard, which is the ordinary state of one between
      // festivals.
      assignment: assignments.get(d.id) ?? null,
    }));
  });

// Named here rather than restated by every reader: the row shape is this function's to
// define, and a list, a menu and a dialog all render one.
export type NoiseMonitorDevice = Awaited<
  ReturnType<typeof noiseMonitorDevices>
>[number];

// A blank bound, stored blank. Both ends of a placement mean "the event's own" when they
// are null (see the schema), so neither writer resolves anything and neither needs to read
// the project to save a row — which is the point: a placement typed as "the whole time"
// keeps following the event's dates instead of being pinned to whatever they were on the
// day somebody filled the form in.
const instantOrNull = (ms: number | null | undefined): Date | null =>
  ms == null ? null : new Date(ms);

export const assignNoiseDevice = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
      locationId: z.string().min(1),
      deviceId: z.string().min(1),
      // Epoch ms, both optional: an omitted bound means the edge of the event, so
      // picking a device and nothing else records "stood here the whole time".
      start: z.number().int().nullish(),
      end: z.number().int().nullish(),
    }),
  )
  .handler(async ({data}) => {
    const [location, device] = await Promise.all([
      prismaClient.noiseLocation.findUnique({
        where: {id: data.locationId},
        select: {id: true},
      }),
      prismaClient.device.findUnique({
        where: {id: data.deviceId},
        select: {id: true, type: true},
      }),
    ]);
    if (!location) throw notFound();
    if (!device || device.type !== 'NOISE_MONITOR') {
      throw new Error('Unbekanntes Lärmmessgerät.');
    }

    // Nothing else is touched. This used to close the device's other open rows so
    // that `end == null` could mean "is here now" — one open row per device. With
    // the windows editable by hand that invariant is neither enforceable nor
    // wanted, so the dialog warns about the overlap instead of the server quietly
    // rewriting a row nobody opened (see overlappingAssignments in projectView.ts).
    await prismaClient.noiseLocationAssignment.create({
      data: {
        locationId: data.locationId,
        deviceId: data.deviceId,
        start: instantOrNull(data.start),
        end: instantOrNull(data.end),
      },
    });
  });

// One row's window, as typed. Times are taken at face value — including ones in the
// future and ones that overlap another placement — because this is a record of where
// a monitor stood, and the person filling it in knows better than a clamp would.
export const updateNoiseAssignment = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
      assignmentId: z.string().min(1),
      start: z.number().int().nullable(),
      end: z.number().int().nullable(),
    }),
  )
  .handler(async ({data}) => {
    // One write, whatever was typed: a blank bound is a blank column now, so an edit that
    // clears the start no longer has to walk down to the event and back for a value to
    // put there.
    await prismaClient.noiseLocationAssignment.update({
      where: {id: data.assignmentId},
      data: {
        start: instantOrNull(data.start),
        end: instantOrNull(data.end),
      },
    });
  });

// Removes the row rather than closing it: a placement that never happened should
// leave no window behind, since assignmentsAt and the log queries both read every
// row there is. Ending one is an edit of its `end`, which is the dialog's other job.
//
// deleteMany, so a double-tap or a stale list deletes nothing twice rather than
// throwing on a row that has already gone.
export const deleteNoiseAssignment = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({assignmentId: z.string().min(1)}))
  .handler(async ({data}) => {
    await prismaClient.noiseLocationAssignment.deleteMany({
      where: {id: data.assignmentId},
    });
  });

export const Route = createFileRoute('/crew/lautstaerke')({
  component: LautstaerkeLayout,
  head: () => seo({title: 'Lautstärke'}),
});

function LautstaerkeLayout() {
  // The seam between the two pipelines, and the reason it's a ref: the BLE hook
  // writes the connected device's name here so the MQTT stream can skip its
  // duplicate copies, and a ref means connecting doesn't re-run the stream's
  // effect and drop the broker connection mid-session.
  const connectedDevice = useRef<string | null>(null);

  const {live, deviceData, ingest} = useNoiseStream({
    skipDevice: connectedDevice,
  });
  const bluetooth = useBleDevice({ingest, connectedDevice});

  // Warn before navigating away or reloading while connected over Bluetooth —
  // leaving the page tears down the BLE connection. Navigating between pages
  // under /crew/lautstaerke keeps the layout (and the connection) mounted, so
  // those moves should not be blocked.
  useBlocker({
    disabled: !bluetooth.deviceName,
    enableBeforeUnload: () => bluetooth.deviceName != null,
    shouldBlockFn: ({next}) => {
      if (next.fullPath.startsWith(Route.fullPath)) return false;
      return !window.confirm(
        'Du bist über Bluetooth verbunden. Wenn du die Seite verlässt, wird die Verbindung getrennt. Trotzdem fortfahren?',
      );
    },
  });

  return (
    // Both of these are the same object for the life of the layout — the buffers a
    // ref, the live records a store subscribed to by device name — so neither provider
    // ever hands its consumers a new value.
    <NoiseBuffersContext.Provider value={deviceData}>
      <NoiseLiveContext.Provider value={live}>
        <BluetoothContext.Provider value={bluetooth}>
          {/* The dark scope itself lives on <html> (see __root), so portalled
            menus, dialogs and toasts get it too. */}
          {/* Tabular figures for the whole area, inherited rather than repeated on
            every readout. The levels, the clock and the battery all change in place
            — a proportional '1' is narrower than a '4', so without this every number
            on the page reflows as it updates, and a dB value twitches once a second.
            The monospace they used to be set in was doing this by accident; this is
            the half of it that was actually wanted.

            Portalled surfaces don't inherit it (they hang off <body>): the menus and
            dialogs show identifiers rather than ticking numbers, so they don't need
            it — CalibrationPanel is the exception and sets it itself. */}
          {/* No padding of its own: the page inside decides where its edges are. The
              project page is a toolbar over an edge-to-edge map, which a gutter here
              would either cut into or leave scrolling content peeking past; the pages
              that do want one set it themselves. The ground is the theme's (`bg`
              under `.dark`, which globalCss also paints html/body with, so the
              overscroll gutter matches); this box is only the viewport height and
              the one thing that scrolls — which is also what the toolbars stick to. */}
          <Box
            fontVariantNumeric="tabular-nums"
            h="100vh"
            display="flex"
            flexDirection="column"
            overflow="auto"
          >
            <Outlet />
          </Box>
          <Toaster />
        </BluetoothContext.Provider>
      </NoiseLiveContext.Provider>
    </NoiseBuffersContext.Provider>
  );
}
