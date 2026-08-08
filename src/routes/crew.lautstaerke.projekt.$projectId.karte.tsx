import {createFileRoute} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useMemo, useState} from 'react';
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

function ProjectMapView() {
  const {projectId} = Route.useParams();
  const {project, live, metric, weighting, viewedAt, levels, refresh} =
    useProjectView();
  // The clicked point, or null while the create dialog is closed. Clicking the
  // map is the only way to add a location, so there is no coordinate-less open —
  // and so the dialog belongs to this view rather than to the layout.
  const [createAt, setCreateAt] = useState<Coordinates | null>(null);

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
          onCreateAt={setCreateAt}
        />
      </Box>

      <NoiseLocationDialog
        coordinates={createAt}
        projectId={projectId}
        onClose={() => setCreateAt(null)}
        onCreated={async () => {
          await refresh();
          setCreateAt(null);
        }}
      />
    </>
  );
}
