/// <reference types="web-bluetooth" />
import {
  createFileRoute,
  notFound,
  Outlet,
  useBlocker,
} from '@tanstack/react-router';
import {Box} from '@chakra-ui/react';
import {z} from 'zod';
import {DarkMode} from '../components/chakra-snippets/color-mode';
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import mqtt from 'mqtt';
import 'uplot/dist/uPlot.min.css';
import {NoiseRecording} from '../proto/noise';
import {seo} from '../utils/seo';
import {
  LautstaerkeContext,
  type LautstaerkeCtx,
} from '../components/lautstaerke/context';
import {
  TOPIC,
  WINDOW_S,
  type DeviceBuffer,
  type DeviceState,
} from '../components/lautstaerke/noise';
import {SERIES} from '../components/lautstaerke/series';
import {
  connectBleDevice,
  decodePendingUploads,
  decodeWifiStatus,
  isWebBluetoothSupported,
  readCalibration,
  subscribeCharacteristic,
  writeCalibration,
  writeWifi,
  type BleConnection,
  type WifiStatus,
} from '../components/lautstaerke/bluetooth';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {prismaClient} from '../server/prismaClient.server';
import {projectLevelsAt} from '../server/noiseHistory.server';
import {Toaster, toaster} from '../components/chakra-snippets/toaster';
import {
  errorMessage,
  errorToast,
} from '../components/lautstaerke/toast';
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
export const noiseName = z
  .string()
  .trim()
  .min(1, 'Name erforderlich')
  .max(60);

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
            // Open assignments only: `end == null` is "a device is standing here
            // right now". Closed rows are history and belong to the device views.
            NoiseLocationAssignment: {
              where: {end: null},
              orderBy: {start: 'asc'},
              select: {
                id: true,
                deviceId: true,
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

export const noiseLevelsAt = createServerFn()
  .middleware([crewAuth])
  .inputValidator(z.object({projectId: z.string().min(1), at: isoInstant}))
  .handler(async ({data}) => projectLevelsAt(data.projectId, new Date(data.at)));

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
    z.object({locationId: z.string().min(1), deviceId: z.string().min(1)}),
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
    // Moving a device closes its previous placement: `end == null` only means
    // "is here now" if exactly one row per device can be open. One `now` for
    // both writes, so the two windows abut exactly and a history query over
    // them neither gaps nor double-counts.
    const now = new Date();
    await prismaClient.$transaction([
      prismaClient.noiseLocationAssignment.updateMany({
        where: {deviceId: data.deviceId, end: null},
        data: {end: now},
      }),
      prismaClient.noiseLocationAssignment.create({
        data: {locationId: data.locationId, deviceId: data.deviceId, start: now},
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
  const [devices, setDevices] = useState<Record<string, DeviceState>>({});
  const deviceDataRef = useRef<Record<string, DeviceBuffer>>({});

  const [bleDeviceName, setBleDeviceName] = useState<string | null>(null);
  const [bleConnecting, setBleConnecting] = useState(false);
  const [bleSupported, setBleSupported] = useState(false);
  const [blePendingUploads, setBlePendingUploads] = useState<number | null>(
    null,
  );
  const [bleWifiStatus, setBleWifiStatus] = useState<WifiStatus | null>(null);

  useEffect(() => {
    setBleSupported(isWebBluetoothSupported());
  }, []);
  const bleConnRef = useRef<BleConnection | null>(null);
  // Teardown callbacks registered while connecting (one per characteristic
  // subscription plus the disconnect listener); cleanupBle runs them all.
  const bleCleanupsRef = useRef<Array<() => void>>([]);

  const ingest = useCallback(
    (deviceName: string, payload: Uint8Array, receiveTime: number) => {
      let decoded: NoiseRecording;
      try {
        decoded = NoiseRecording.decode(payload);
      } catch (e) {
        console.error('[lautstärke] decode error', e);
        return;
      }
      let data = deviceDataRef.current[deviceName];
      if (!data) {
        data = [[], ...SERIES.map(() => [] as number[])];
        deviceDataRef.current[deviceName] = data;
      }
      data[0].push(receiveTime / 1000);
      SERIES.forEach((s, j) => data[j + 1].push(s.get(decoded)));

      // Non-urgent: MQTT records arrive several times a second. As an *urgent*
      // update this preempts (and, on slower/mobile renders, permanently
      // starves) TanStack Router's route transition — the URL commits but the
      // detail view never swaps in. Demoting it to a transition lets navigation
      // win; the live values lag at most a frame, which is imperceptible here.
      startTransition(() =>
        setDevices((prev) => ({
          ...prev,
          [deviceName]: {
            lastSeen: receiveTime,
            latest: decoded,
          },
        })),
      );
    },
    [],
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const minTs = Date.now() / 1000 - WINDOW_S;
      for (const data of Object.values(deviceDataRef.current)) {
        let cutoff = 0;
        while (cutoff < data[0].length && data[0][cutoff]! < minTs) cutoff++;
        if (cutoff > 0) for (const col of data) col.splice(0, cutoff);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clean: true,
      reconnectPeriod: 2000,
      clientId: `kult-lautstaerke-${Math.random().toString(16).slice(2, 10)}`,
    });

    client.on('connect', () => {
      client.subscribe(TOPIC, {qos: 0}, (err) => {
        if (err) console.error('[lautstärke] subscribe error', err);
      });
    });
    client.on('error', (e) => console.error('[lautstärke] mqtt error', e));

    client.on('message', (topic, payload) => {
      const deviceName = topic.split('/')[1];
      if (!deviceName) return;
      if (bleConnRef.current?.deviceName === deviceName) return;
      ingest(deviceName, payload, Date.now());
    });

    return () => {
      client.removeAllListeners();
      client.end(true);
    };
  }, [ingest]);

  const cleanupBle = useCallback(() => {
    // Detach every characteristic listener + the disconnect listener, then drop
    // the GATT link.
    for (const cleanup of bleCleanupsRef.current) {
      try {
        cleanup();
      } catch {}
    }
    bleCleanupsRef.current = [];
    try {
      bleConnRef.current?.device.gatt?.disconnect();
    } catch {}
    bleConnRef.current = null;
    setBleDeviceName(null);
    setBlePendingUploads(null);
    setBleWifiStatus(null);
  }, []);

  const disconnectBle = useCallback(async () => {
    cleanupBle();
  }, [cleanupBle]);

  const connectBle = useCallback(async (): Promise<string | null> => {
    if (bleConnecting) return null;
    if (bleConnRef.current) cleanupBle();
    setBleConnecting(true);
    try {
      const conn = await connectBleDevice();
      const onDisconnect = () => {
        cleanupBle();
        toaster.create({
          type: 'info',
          title: 'Bluetooth-Verbindung getrennt',
        });
      };
      conn.device.addEventListener('gattserverdisconnected', onDisconnect);
      // Each subscription reads its current value on connect and updates on
      // notify; the record stream is live-only (no initial read) so we don't
      // plot a stale sample. Every registered cleanup runs in cleanupBle.
      bleCleanupsRef.current = [
        subscribeCharacteristic(
          conn.characteristic,
          (value) =>
            ingest(
              conn.deviceName,
              new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
              Date.now(),
            ),
          {readInitial: false},
        ),
        subscribeCharacteristic(conn.uploadsCharacteristic, (value) =>
          setBlePendingUploads(decodePendingUploads(value)),
        ),
        subscribeCharacteristic(conn.wifiStatusCharacteristic, (value) => {
          // Ignore the 0xff subscribe sentinel / unknown values (decode → null).
          const status = decodeWifiStatus(value);
          if (status) setBleWifiStatus(status);
        }),
        () =>
          conn.device.removeEventListener(
            'gattserverdisconnected',
            onDisconnect,
          ),
      ];
      bleConnRef.current = conn;
      setBleDeviceName(conn.deviceName);
      return conn.deviceName;
    } catch (e) {
      // Cancelling the chooser is not a failure, so it gets no toast.
      if (
        !(e instanceof DOMException && e.name === 'NotFoundError') &&
        !/User cancelled/i.test(errorMessage(e))
      ) {
        errorToast('Bluetooth-Verbindung fehlgeschlagen')(e);
      }
      return null;
    } finally {
      setBleConnecting(false);
    }
  }, [bleConnecting, cleanupBle, ingest]);

  const readCal = useCallback(async () => {
    const conn = bleConnRef.current;
    if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
    return readCalibration(conn);
  }, []);

  const writeCal = useCallback(async (offsetsDb: number[]) => {
    const conn = bleConnRef.current;
    if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
    await writeCalibration(conn, offsetsDb);
  }, []);

  const writeWifiCreds = useCallback(async (ssid: string, password: string) => {
    const conn = bleConnRef.current;
    if (!conn) throw new Error('Kein Gerät über Bluetooth verbunden.');
    await writeWifi(conn, ssid, password);
  }, []);

  useEffect(() => {
    return () => cleanupBle();
  }, [cleanupBle]);

  // Warn before navigating away or reloading while connected over Bluetooth —
  // leaving the page tears down the BLE connection. Navigating between pages
  // under /crew/lautstaerke keeps the layout (and the connection) mounted, so
  // those moves should not be blocked.
  useBlocker({
    disabled: !bleDeviceName,
    enableBeforeUnload: () => bleDeviceName != null,
    shouldBlockFn: ({next}) => {
      if (next.fullPath.startsWith(Route.fullPath)) return false;
      return !window.confirm(
        'Du bist über Bluetooth verbunden. Wenn du die Seite verlässt, wird die Verbindung getrennt. Trotzdem fortfahren?',
      );
    },
  });

  const ctx = useMemo<LautstaerkeCtx>(
    () => ({
      devices,
      deviceData: deviceDataRef,
      bluetooth: {
        deviceName: bleDeviceName,
        connecting: bleConnecting,
        supported: bleSupported,
        pendingUploads: blePendingUploads,
        wifiStatus: bleWifiStatus,
        connect: connectBle,
        disconnect: disconnectBle,
        readCalibration: readCal,
        writeCalibration: writeCal,
        writeWifi: writeWifiCreds,
      },
    }),
    [
      devices,
      bleDeviceName,
      bleConnecting,
      bleSupported,
      blePendingUploads,
      bleWifiStatus,
      connectBle,
      disconnectBle,
      readCal,
      writeCal,
      writeWifiCreds,
    ],
  );

  return (
    <LautstaerkeContext.Provider value={ctx}>
      <DarkMode>
        <Box
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
      </DarkMode>
    </LautstaerkeContext.Provider>
  );
}
