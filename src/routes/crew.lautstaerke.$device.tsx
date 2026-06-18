import {createFileRoute, Outlet, useParams} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {useState} from 'react';
import {Box} from '@chakra-ui/react';
import {type Weighting} from '../components/lautstaerke/context';
import {DeviceHeader} from '../components/lautstaerke/DeviceHeader';
import {
  DeviceViewContext,
  deviceTitle,
  resolveLocation,
} from '../components/lautstaerke/deviceView';
import {deviceLocations, noiseDays} from '../server/noiseHistory.server';
import {seo} from '../utils/seo';

const loadDevice = createServerFn()
  .middleware([crewAuth])
  .inputValidator((device: string) => device)
  .handler(async ({data: device}) => {
    const [days, locations] = await Promise.all([
      noiseDays(device),
      deviceLocations(device),
    ]);
    return {days, locations};
  });

export const Route = createFileRoute('/crew/lautstaerke/$device')({
  component: DeviceLayout,
  loader: ({params}) => loadDevice({data: params.device}),
  head: ({matches, params}) =>
    seo({title: `Lautstärke – ${deviceTitle(matches, params.device, null)}`}),
});

// Layout shared by the live and historical views: owns the weighting toggle and
// renders the common header, with the matched child view below via <Outlet />.
function DeviceLayout() {
  const {device} = Route.useParams();
  // The historical child adds a `date` param; its presence is how we tell the
  // two views apart (and what the day picker should show as selected).
  const {date} = useParams({strict: false});
  const {days, locations} = Route.useLoaderData();
  const [weighting, setWeighting] = useState<Weighting>('A');
  const toggleWeighting = () => setWeighting((w) => (w === 'A' ? 'C' : 'A'));

  // Day-aware: the historical view shows where the device stood on that day.
  const location = resolveLocation(locations, date ?? null);

  return (
    <DeviceViewContext.Provider value={{weighting, toggleWeighting}}>
      <Box display="flex" flexDirection="column" flex="1" minH="0">
        <DeviceHeader
          device={device}
          location={location}
          days={days}
          dayValue={date ?? 'live'}
        />
        <Outlet />
      </Box>
    </DeviceViewContext.Provider>
  );
}
