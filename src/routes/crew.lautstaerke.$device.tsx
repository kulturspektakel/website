import {createFileRoute, Outlet} from '@tanstack/react-router';
import {createServerFn} from '@tanstack/react-start';
import {crewAuth} from '../server/crewAuth';
import {useState} from 'react';
import {Box} from '@chakra-ui/react';
import {type Weighting} from '../components/lautstaerke/context';
import {DeviceHeader} from '../components/lautstaerke/DeviceHeader';
import {
  DeviceViewContext,
  dayKey,
  deviceTitle,
  resolveLocation,
} from '../components/lautstaerke/deviceView';
import {parseRangeSearch} from '../components/lautstaerke/timeframe';
import {deviceLocations} from '../server/noiseHistory.server';
import {seo} from '../utils/seo';

const loadDevice = createServerFn()
  .middleware([crewAuth])
  .inputValidator((device: string) => device)
  .handler(async ({data: device}) => ({
    locations: await deviceLocations(device),
  }));

export const Route = createFileRoute('/crew/lautstaerke/$device')({
  component: DeviceLayout,
  // The viewed timeframe. Declared on the layout so the header's picker and the
  // child view both see it, and normalized to ISO-8601 UTC so the canonical
  // URL — and the search identity the loader refetches on — is stable no matter
  // what offset the incoming value was written in. No range means the live view.
  validateSearch: (
    search: Record<string, unknown>,
  ): {start?: string; end?: string} => {
    const range = parseRangeSearch(search);
    return range
      ? {start: range.start.toISOString(), end: range.end.toISOString()}
      : {};
  },
  loader: ({params}) => loadDevice({data: params.device}),
  // `head` gets no `search` of its own, but its own match carries it.
  head: ({match, matches, params}) => {
    const start = match.search.start;
    const date = start ? dayKey(Date.parse(start)) : null;
    return seo({
      title: `Lautstärke – ${deviceTitle(matches, params.device, date)}`,
    });
  },
});

// Layout shared by the live and historical views: owns the weighting toggle and
// renders the common header, with the matched child view below via <Outlet />.
function DeviceLayout() {
  const {device} = Route.useParams();
  const {start} = Route.useSearch();
  const {locations} = Route.useLoaderData();
  const [weighting, setWeighting] = useState<Weighting>('A');
  const toggleWeighting = () => setWeighting((w) => (w === 'A' ? 'C' : 'A'));
  const [peaks, setPeaks] = useState(false);
  const togglePeaks = () => setPeaks((p) => !p);

  // Day-aware: the historical view shows where the device stood on the day its
  // timeframe starts in.
  const location = resolveLocation(
    locations,
    start ? dayKey(Date.parse(start)) : null,
  );

  return (
    <DeviceViewContext.Provider
      value={{weighting, toggleWeighting, peaks, togglePeaks}}
    >
      <Box display="flex" flexDirection="column" flex="1" minH="0">
        <DeviceHeader device={device} location={location} />
        <Outlet />
      </Box>
    </DeviceViewContext.Provider>
  );
}
