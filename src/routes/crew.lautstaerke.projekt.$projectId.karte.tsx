import {createFileRoute} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useEffect, useMemo, useState} from 'react';
import {toaster} from '../components/chakra-snippets/toaster';
import LocationsMap, {
  type Coordinates,
} from '../components/lautstaerke/LocationsMap';
import {MAP_BACKGROUND} from '../components/lautstaerke/mapStyle';
import {NoiseLocationDialog} from '../components/lautstaerke/NoiseLocationDialog';
import {
  assignmentsAt,
  useProjectView,
} from '../components/lautstaerke/projectView';

export const Route = createFileRoute(
  '/crew/lautstaerke/projekt/$projectId/karte',
)({
  component: ProjectMapView,
});

// A fixed id, so arming the tool twice replaces the prompt rather than stacking two.
const PLACE_TOAST = 'noise-place-location';

function ProjectMapView() {
  const {projectId} = Route.useParams();
  const {project, live, metric, weighting, viewedAt, levels, refresh} =
    useProjectView();
  // The clicked point, or null while the create dialog is closed. A location is only
  // ever placed by clicking the map, so there is no coordinate-less open — and so the
  // dialog belongs to this view rather than to the layout.
  const [createAt, setCreateAt] = useState<Coordinates | null>(null);
  // Whether the plus button has armed the map. Lives here rather than in the map
  // because what disarms it is the dialog closing, which the map knows nothing about:
  // one location per press of the button, and then the map is a map again.
  const [placing, setPlacing] = useState(false);

  // The prompt, for exactly as long as it is an instruction: from arming the tool
  // until a point is picked or the tool is dropped. Persistent rather than timed —
  // it is the only thing telling you what the crosshair is waiting for, and it
  // outlives any five seconds a toast would give it.
  const prompting = placing && createAt == null;
  useEffect(() => {
    if (!prompting) return;
    toaster.create({
      id: PLACE_TOAST,
      type: 'info',
      title: 'Auf die Karte klicken, um den Standort zu setzen',
      duration: Number.POSITIVE_INFINITY,
    });
    return () => toaster.dismiss(PLACE_TOAST);
  }, [prompting]);

  // The map wants each location's monitors flattened; the list view keeps the
  // assignments themselves, since it renders one row each. Which monitors those are
  // depends on when you're looking: live shows the ones standing there now, and
  // scrubbing shows whoever stood there then.
  const mapLocations = useMemo(
    () =>
      project.locations.map((location) => ({
        ...location,
        deviceIds: assignmentsAt(location.assignments, viewedAt).map(
          (a) => a.deviceId,
        ),
      })),
    [project.locations, viewedAt],
  );

  // Reachable only by hand-typed URL — the index route sends a keyless
  // deployment to the list, and the view switcher isn't rendered at all. Says so
  // rather than redirecting, so the URL you typed doesn't silently become
  // another one.
  if (!project.apiKey) {
    return (
      <Text color="gray.500">
        Ohne Google-Maps-Schlüssel ist die Karte nicht verfügbar.
      </Text>
    );
  }

  return (
    <>
      {/* The map is shown even with no locations — an empty project's map is the
          fastest way to place the first one, and it frames the festival site by
          default. It takes the height the header and timeline leave over; minH
          keeps it usable on a short viewport, where the page scrolls instead. */}
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
          metric={metric}
          weighting={weighting}
          history={levels}
          placing={placing}
          onPlacingChange={setPlacing}
          onCreateAt={setCreateAt}
        />
      </Box>

      <NoiseLocationDialog
        coordinates={createAt}
        projectId={projectId}
        projectStart={project.start}
        // Whether it was saved or abandoned, the tool has done its one job: the map
        // goes back to being read-only until the plus is pressed again.
        onClose={() => {
          setCreateAt(null);
          setPlacing(false);
        }}
        onCreated={async () => {
          await refresh();
          setCreateAt(null);
          setPlacing(false);
        }}
      />
    </>
  );
}
