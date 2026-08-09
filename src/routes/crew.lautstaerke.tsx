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
import {projectLogs} from '../server/noiseHistory.server';
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
        NoiseLocation: {
          orderBy: {locationName: 'asc'},
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
          start: a.start.getTime(),
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
// the whole event travels, so scrubbing, cropping and the header's dropdowns never
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

export const assignNoiseDevice = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({
      locationId: z.string().min(1),
      deviceId: z.string().min(1),
      // Epoch ms, and optional: assigning from a location card means "from now",
      // while a location created on the map offers the project's start, so its
      // monitor's history covers the event rather than beginning mid-festival.
      // Never in the future — a placement that hasn't begun would leave the new
      // location looking empty until it did.
      start: z.number().int().optional(),
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
    const now = new Date();
    const start =
      data.start == null ? now : new Date(Math.min(data.start, now.getTime()));

    // Moving a device closes its previous placement: `end == null` only means
    // "is here now" if exactly one row per device can be open. Each is closed at
    // the moment this one begins, so the two windows abut exactly and a history
    // query over them neither gaps nor double-counts — except where the new start
    // predates the open row, which a backdated assignment can do: there the old
    // window would invert, so it closes at its own start instead (an empty window,
    // which is the truthful record of a placement that never held).
    const open = await prismaClient.noiseLocationAssignment.findMany({
      where: {deviceId: data.deviceId, end: null},
      select: {id: true, start: true},
    });
    await prismaClient.$transaction([
      ...open.map((assignment) =>
        prismaClient.noiseLocationAssignment.update({
          where: {id: assignment.id},
          data: {
            end: assignment.start > start ? assignment.start : start,
          },
        }),
      ),
      prismaClient.noiseLocationAssignment.create({
        data: {
          locationId: data.locationId,
          deviceId: data.deviceId,
          start,
        },
      }),
    ]);
  });

// Records a new location for a device. DeviceLocation is history — each call
// appends a placement (latitude/longitude left null for now); resolveLocation
// picks the one in effect on the viewed day. id/createdAt have no DB default,
// so we set them here.
export const setDeviceLocation = createServerFn()
  .middleware([crewAuth])
  .inputValidator(
    z.object({device: z.string(), locationName: z.string().trim().min(1)}),
  )
  .handler(async ({data}) => {
    await prismaClient.deviceLocation.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: data.device,
        locationName: data.locationName,
        createdAt: new Date(),
      },
    });
  });

export const endNoiseAssignment = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({assignmentId: z.string().min(1)}))
  .handler(async ({data}) => {
    // updateMany + `end: null` makes this idempotent: a double-tap or a stale
    // list can't overwrite an already-recorded end, and a vanished row is a
    // no-op rather than a throw.
    await prismaClient.noiseLocationAssignment.updateMany({
      where: {id: data.assignmentId, end: null},
      data: {end: new Date()},
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
          <Box
            fontVariantNumeric="tabular-nums"
            bg="gray.900"
            color="gray.100"
            h="100vh"
            display="flex"
            flexDirection="column"
            overflow="auto"
            p="4"
          >
            <Outlet />
          </Box>
          <Toaster />
        </BluetoothContext.Provider>
      </NoiseLiveContext.Provider>
    </NoiseBuffersContext.Provider>
  );
}
