import {createFileRoute, Link} from '@tanstack/react-router';
import {
  Box,
  Heading,
  HStack,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useMemo, useState} from 'react';
import {LuArrowLeft} from 'react-icons/lu';
import {loadNoiseProject, noiseLevelsAt} from './crew.lautstaerke';
import {
  floorToMinute,
  formatProjectRange,
  parseProjectSelectionSearch,
  projectSelectionSearch,
  resolveProjectSelection,
  visibleProjectWindow,
  type ProjectSelection,
} from '../components/lautstaerke/timeframe';
import {useNowAfterMount} from '../components/lautstaerke/context';
import {ProjectTimeline} from '../components/lautstaerke/ProjectTimeline';
import {SegmentedControl} from '../components/chakra-snippets/segmented-control';
import {Switch} from '../components/chakra-snippets/switch';
import {DeviceRow} from '../components/lautstaerke/DeviceRow';
import LocationsMap, {
  type Coordinates,
} from '../components/lautstaerke/LocationsMap';
import {MAP_BACKGROUND} from '../components/lautstaerke/mapStyle';
import {NoiseLocationDialog} from '../components/lautstaerke/NoiseLocationDialog';
import {
  AssignDeviceMenu,
  AssignmentMenu,
} from '../components/lautstaerke/AssignDeviceMenu';
import {seo} from '../utils/seo';

type NoiseProject = Awaited<ReturnType<typeof loadNoiseProject>>;
type NoiseLocationItem = NoiseProject['locations'][number];

// Either/or rather than both: the map is only useful at a size worth giving the
// whole viewport to, and the cards below it were pushing it into a letterbox.
type View = 'map' | 'list';
const VIEWS: Array<{value: View; label: string}> = [
  {value: 'map', label: 'Karte'},
  {value: 'list', label: 'Liste'},
];

// `projekt/` is a static segment because $device already occupies the dynamic slot
// under /crew/lautstaerke — a cuid and a device name are indistinguishable at
// match time, so the two routes would be ambiguous. This also leaves every
// bookmarked device URL untouched.
export const Route = createFileRoute('/crew/lautstaerke/projekt/$projectId')({
  // Shape only — clamping the selection needs the project's window, which the
  // loader hasn't fetched yet. Deliberately not a loaderDep: the selection
  // filters what's already loaded, so scrubbing must not refetch.
  validateSearch: parseProjectSelectionSearch,
  loader: ({params}) => loadNoiseProject({data: {projectId: params.projectId}}),
  head: ({loaderData}) =>
    seo({title: `Lautstärke – ${loaderData?.name ?? 'Projekt'}`}),
  component: NoiseProjectDetail,
});

function NoiseProjectDetail() {
  const {projectId} = Route.useParams();
  const initial = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  // The clicked point, or null while the create dialog is closed. Clicking the
  // map is the only way to add a location, so there is no coordinate-less open.
  const [createAt, setCreateAt] = useState<Coordinates | null>(null);
  const [view, setView] = useState<View>('map');
  // Live is the default: this page's job during a festival is watching the
  // monitors right now, which is also what it did before there was a cursor.
  const [live, setLive] = useState(true);

  const {data: project} = useQuery({
    queryKey: ['noiseProject', projectId],
    queryFn: () => loadNoiseProject({data: {projectId}}),
    initialData: initial,
  });

  // Without a Maps key there is no map to switch to, so the list is all there is.
  const mapAvailable = project.apiKey != null;
  const shown = mapAvailable ? view : 'list';

  // Null for the first paint (see useNowAfterMount), so SSR falls back to the
  // project's own end and the clamp appears immediately after mount. Re-ticks
  // once a minute, so the edge keeps up during a running event.
  const now = useNowAfterMount();
  const pickable = visibleProjectWindow(project, now ?? project.end);
  const cappedToNow = pickable.end < project.end;
  const selection = resolveProjectSelection(search, pickable);

  // replace, so dragging the timeline doesn't fill the back stack with every
  // intermediate range.
  const commitSelection = (next: ProjectSelection) =>
    navigate({search: projectSelectionSearch(next), replace: true});

  // The stored levels for the playhead's minute. Keyed on the minute so scrubbing
  // reuses what it already fetched, and skipped entirely while live.
  const playheadMinute = floorToMinute(selection.current);
  const {data: history} = useQuery({
    queryKey: ['noiseLevelsAt', projectId, playheadMinute],
    queryFn: () =>
      noiseLevelsAt({
        data: {projectId, at: new Date(playheadMinute).toISOString()},
      }),
    enabled: !live,
  });

  // The map wants each location's monitors flattened; the cards keep the
  // assignments themselves, since they render one row each.
  const mapLocations = useMemo(
    () =>
      project.locations.map((location) => ({
        ...location,
        deviceIds: location.assignments.map((a) => a.deviceId),
      })),
    [project.locations],
  );

  // Assigning or ending changes both this project's locations and which devices
  // are still available, on this page and on the index.
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: ['noiseProject', projectId]}),
      queryClient.invalidateQueries({queryKey: ['assignableNoiseDevices']}),
      queryClient.invalidateQueries({queryKey: ['noiseProjects']}),
    ]);
  };

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
      <HStack mb="6" align="center">
        <IconButton
          asChild
          aria-label="Zurück zur Projektliste"
          variant="ghost"
          size="sm"
        >
          <Link to="/crew/lautstaerke">
            <LuArrowLeft />
          </Link>
        </IconButton>
        <VStack align="start" gap="0" flex="1" minW="0">
          <Heading as="h1" size="2xl" truncate w="full">
            {project.name}
          </Heading>
          <Text fontSize="sm" color="gray.500">
            {formatProjectRange(project.start, project.end)}
          </Text>
        </VStack>
        <HStack gap="3" flexShrink="0">
          <Switch
            size="sm"
            checked={live}
            onCheckedChange={(e) => setLive(e.checked)}
            colorPalette="green"
          >
            <Text fontSize="sm">Live</Text>
          </Switch>
          {mapAvailable && (
            <SegmentedControl
              size="xs"
              value={shown}
              onValueChange={(e) => setView(e.value as View)}
              items={VIEWS}
            />
          )}
        </HStack>
      </HStack>

      <Box mb="4">
        <ProjectTimeline
          window={pickable}
          cappedToNow={cappedToNow}
          live={live}
          selection={selection}
          onCommit={commitSelection}
        />
      </Box>

      {/* The map is shown even with no locations — an empty project's map is the
          fastest way to place the first one, and it frames the festival site by
          default. It takes the height the header and timeline leave over; minH
          keeps it usable on a short viewport, where the page scrolls instead. */}
      {shown === 'map' && project.apiKey ? (
        <Box
          flex="1"
          minH="20rem"
          mb="4"
          rounded="md"
          overflow="hidden"
          borderWidth="1px"
          borderColor="gray.700"
          // The map fills this box by absolute inset, so it needs a positioned
          // ancestor — and that avoids resolving a percentage height against a
          // flex-derived one, which browsers treat inconsistently.
          position="relative"
          // Same color the map style paints the ground, so the box doesn't flash
          // white while the first tiles load.
          bg={MAP_BACKGROUND}
        >
          <LocationsMap
            apiKey={project.apiKey}
            locations={mapLocations}
            live={live}
            history={history}
            onCreateAt={setCreateAt}
          />
        </Box>
      ) : project.locations.length === 0 ? (
        <Text color="gray.500">
          {/* A location can only be placed on the map, so without a Maps key
              there is no way in at all — say so rather than showing an empty
              list and no control. */}
          {mapAvailable
            ? 'Noch keine Standorte.'
            : 'Noch keine Standorte. Ohne Google-Maps-Schlüssel ist die Karte nicht verfügbar, daher können derzeit keine Standorte angelegt werden.'}
        </Text>
      ) : (
        <VStack align="stretch" gap="3" pb="4">
          {project.locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              live={live}
              history={history}
              onChanged={refresh}
            />
          ))}
        </VStack>
      )}

      <NoiseLocationDialog
        coordinates={createAt}
        projectId={projectId}
        onClose={() => setCreateAt(null)}
        onCreated={async () => {
          await refresh();
          setCreateAt(null);
        }}
      />
    </Box>
  );
}

function LocationCard({
  location,
  live,
  history,
  onChanged,
}: {
  location: NoiseLocationItem;
  live: boolean;
  history?: Record<string, number>;
  onChanged: () => Promise<void>;
}) {
  return (
    <VStack
      align="stretch"
      gap="2"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      <HStack justify="space-between" align="start" gap="3">
        <Box minW="0">
          <Text fontWeight="bold" truncate>
            {location.locationName}
          </Text>
          <Text fontFamily="mono" fontSize="xs" color="gray.500">
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        </Box>
        <AssignDeviceMenu locationId={location.id} onAssigned={onChanged} />
      </HStack>

      {location.assignments.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          Kein Gerät zugewiesen.
        </Text>
      ) : (
        location.assignments.map((assignment) => (
          <DeviceRow
            key={assignment.id}
            deviceName={assignment.deviceId}
            locationName={location.locationName}
            lastSeen={assignment.lastSeen}
            live={live}
            historyDb={history?.[assignment.deviceId]}
            action={
              <AssignmentMenu
                assignmentId={assignment.id}
                onEnded={onChanged}
              />
            }
          />
        ))
      )}
    </VStack>
  );
}
