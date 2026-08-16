import {createFileRoute} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {prismaClient} from '../server/prismaClient.server';
import {useMemo} from 'react';
import {Box, HStack, VisuallyHidden} from '@chakra-ui/react';
import {DeviceMenu} from '../components/noise/DeviceMenu';
import {DevicePicker} from '../components/noise/DevicePicker';
import {DeviceStatusLine} from '../components/noise/DeviceStatusLine';
import {LevelPicker, useLevelPick} from '../components/noise/LevelPicker';
import {LiveView} from '../components/noise/LiveView';
import {NoiseToolbar} from '../components/noise/NoiseToolbar';
import {DeviceViewContext} from '../components/noise/deviceView';
import {ReferenceMicPanel} from '../components/noise/ReferenceMicPanel';
import {useReferenceMic} from '../components/noise/useReferenceMic';
import {deviceAssignment} from '../server/noiseHistory.server';
import {seo} from '../utils/seo';

// Where the monitor is placed and when it was last heard from — the only two things this
// page needs the database for, everything else it shows is arriving over MQTT. See
// deviceAssignment for why a placement is a row rather than a field.
//
// The record's own "last seen" and not the stream's, because a page opened this morning has
// nothing else to say about a monitor that went quiet last night: the live store only knows
// what has arrived since this tab connected. The two are merged where they are read (see
// lastSeenAt), so a device transmitting a second before the page loaded is not called
// offline either.
const loadDevice = createServerFn()
  .middleware([crewAuth])
  .inputValidator((device: string) => device)
  .handler(async ({data: device}) => {
    const [assignment, row] = await Promise.all([
      deviceAssignment(device),
      // Null for a name that has never reported: nothing forbids navigating to one, and it
      // reads as "nie gesehen" rather than as an error.
      prismaClient.device.findUnique({
        where: {id: device},
        select: {lastSeen: true},
      }),
    ]);
    return {assignment, lastSeen: row?.lastSeen?.getTime() ?? null};
  });

// `device/` is a static segment, and has to be: a project id and a device name are
// indistinguishable at match time, so two dynamic routes directly under
// /crew/noise would be ambiguous. `project/` earns its own for the same reason.
export const Route = createFileRoute('/crew/noise/device/$device')({
  component: DevicePage,
  loader: ({params}) => loadDevice({data: params.device}),
  // The stage it is standing at when it is standing at one, else its bare name — the same
  // answer the toolbar gives, so a tab and the page it belongs to cannot name two different
  // places. Read off this route's own loader data, which is undefined for the paint before
  // it resolves.
  head: ({loaderData, params}) =>
    seo({
      title: `Noise – ${loaderData?.assignment?.locationName ?? params.device}`,
    }),
});

// The page for one monitor: what it is reading now, in the window and weighting the
// toolbar is set to. Live and nothing else — a monitor's past is read at the place it was
// standing, on the project page, where a reading has a location and a timeframe to mean
// anything against. This page is the instrument, not the record.
//
// One route, not a layout with a view under it: with a single view there is nothing for an
// <Outlet /> to choose between, and the choices the toolbar makes are this component's own
// state either way.
function DevicePage() {
  const {device} = Route.useParams();
  const {assignment, lastSeen} = Route.useLoaderData();
  // Which windows the chart draws and which weighting they are read in — the same coupled
  // pair the project page sets, from the one place that knows they are coupled. No primary
  // taken off the set: nothing on this page reads a single window (see DeviceViewCtx).
  const {weighting, setWeighting, metrics, toggleMetric} = useLevelPick();
  // The microphone the monitor can be measured against. Here rather than in the section
  // layout on purpose: a page is the only thing that measures, and a microphone left open
  // behind a page nobody is looking at keeps the browser's recording indicator lit.
  const referenceMic = useReferenceMic();

  // Pinned, so the charts below are not handed a new context on every render of the page.
  const view = useMemo(
    () => ({weighting, setWeighting, metrics, toggleMetric, referenceMic}),
    [weighting, setWeighting, metrics, toggleMetric, referenceMic],
  );

  return (
    <DeviceViewContext.Provider value={view}>
      {/* Grows past the viewport rather than being clamped to it, so the toolbar can
          stick to the area layout's scroll box — see the project page, which is laid
          out the same way and for the same reason. */}
      <Box display="flex" flexDirection="column" flex="1 0 auto">
        {/* The visible title is a select, which is a control and not a heading — so the
            page keeps one here for anything that navigates by them. */}
        <VisuallyHidden asChild>
          <h1>{device}</h1>
        </VisuallyHidden>
        <NoiseToolbar
          // The monitor's name *is* the way to the next monitor, so the title is a picker
          // and not a heading — see DevicePicker. What state it is in sits beside it, the
          // battery first, because a page about one instrument is opened to ask either
          // "how loud" (below) or "is it still up" (here).
          title={
            <HStack gap="2" minW="0" w="full">
              <DevicePicker device={device} />
              <DeviceStatusLine
                device={device}
                assignment={assignment}
                lastSeen={lastSeen}
              />
            </HStack>
          }
        >
          {/* The two choices the charts below are drawn from. `live` only labels them —
              the finest window is a second here, where the project page's stored one is
              a minute. No live switch beside them: this page has no other mode.

              The same set the tile row above the chart lights, and either control sets it:
              a menu is how you pick a window that is not on screen, a tile is how you drop
              one you can see. */}
          <LevelPicker
            live
            weighting={weighting}
            metrics={metrics}
            onWeighting={setWeighting}
            onToggleMetric={toggleMetric}
          />
          <DeviceMenu device={device} />
        </NoiseToolbar>
        {/* Its own gutter, unlike the project page's edge-to-edge map: what is below is
            charts, and a chart hard against the window edge reads as a cropped one. */}
        <Box
          display="flex"
          flexDirection="column"
          flex="1"
          minH="0"
          p="4"
          gap="2"
        >
          <LiveView device={device} />
        </Box>
      </Box>
      {/* Rendered here rather than by the ⋮ that opens it: whether it is showing, and with it
          whether a microphone is held open, belongs to the slice this route owns — so no
          component's local state is what keeps the recording indicator honest. */}
      <ReferenceMicPanel />
    </DeviceViewContext.Provider>
  );
}
