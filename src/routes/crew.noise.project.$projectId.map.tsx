import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {toaster} from '../components/chakra-snippets/toaster';
import LocationsMap, {type Coordinates} from '../components/noise/LocationsMap';
import {NoiseLocationDialog} from '../components/noise/NoiseLocationDialog';
import {
  usePlayheadLevels,
  useProjectView,
} from '../components/noise/projectView';

export const Route = createFileRoute('/crew/noise/project/$projectId/map')({
  component: ProjectMapView,
});

// A fixed id, so arming the tool twice replaces the prompt rather than stacking two.
const PLACE_TOAST = 'noise-place-location';

function ProjectMapView() {
  const {projectId} = Route.useParams();
  const {project, live, metric, weighting, locations, refresh} =
    useProjectView();
  // Read here rather than inside the map: what a pin shows at the playhead is a
  // question about this page, and LocationsMap is a map — it takes levels, not a
  // project. This view re-renders as the playhead crosses a minute either way.
  const levels = usePlayheadLevels();
  // The clicked point, or null while the create dialog is closed. A location is only
  // ever placed by clicking the map, so there is no coordinate-less open — and so the
  // dialog belongs to this view rather than to the layout.
  const [createAt, setCreateAt] = useState<Coordinates | null>(null);
  // Whether the plus button has armed the map. Lives here rather than in the map
  // because what disarms it is the dialog closing, which the map knows nothing about:
  // one location per press of the button, and then the map is a map again.
  const [placing, setPlacing] = useState(false);

  // Pressing a pin goes to that place's card. The map asked a question a badge can only
  // half answer — 88 dB of what, and how did it get there — and the list is where the
  // trace, the totals and the monitors standing there are. Which place it is travels in
  // the history entry rather than the URL (see locationSelection.ts); the moment being
  // looked at rides along on the layout's retainSearchParams, so a scrubbed map hands the
  // list the same instant. Nothing is said about how wide the cards are: the list remembers
  // that itself (see listColumns.ts), and the one card handed over gets the whole row
  // whatever the count, being the only thing on the page.
  //
  // A step of its own and not a replace: the map is where you came from, and back is how
  // you get to the pin next to this one.
  const navigate = useNavigate();
  const select = useCallback(
    (locationId: string) =>
      navigate({
        to: '/crew/noise/project/$projectId/list',
        params: {projectId},
        state: {focusLocation: locationId},
      }),
    [navigate, projectId],
  );

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
      title: 'Click the map to place the location',
      duration: Number.POSITIVE_INFINITY,
    });
    return () => toaster.dismiss(PLACE_TOAST);
  }, [prompting]);

  // The map wants each location's monitors flattened; the list view keeps the
  // assignments themselves, since it renders one row each. Which monitors those are
  // was already decided by the layout — live means the ones standing there now, and
  // scrubbing whoever stood there then — so this only reshapes the answer, and inherits
  // its identity: the memo holds still through a scrub, and so does the memo'd map.
  const mapLocations = useMemo(
    () =>
      locations.map(({location, assignments}) => ({
        ...location,
        deviceIds: assignments.map((a) => a.deviceId),
      })),
    [locations],
  );

  // Reachable only by hand-typed URL — the index route sends a keyless
  // deployment to the list, and the view switcher isn't rendered at all. Says so
  // rather than redirecting, so the URL you typed doesn't silently become
  // another one.
  if (!project.apiKey) {
    return (
      <Text color="fg.subtle">
        Without a Google Maps key the map is unavailable.
      </Text>
    );
  }

  return (
    <>
      {/* The map is shown even with no locations — an empty project's map is the
          fastest way to place the first one, and it frames the festival site by
          default. It takes everything the toolbars leave over, edge to edge and
          unframed: a border round it would be a line drawn just inside the window's
          own. minH keeps it usable on a short viewport, where the page scrolls
          under the toolbars instead. */}
      <Box
        flex="1"
        minH="20rem"
        overflow="hidden"
        // The map fills this box by absolute inset, so it needs a positioned
        // ancestor — and that avoids resolving a percentage height against a
        // flex-derived one, which browsers treat inconsistently.
        position="relative"
        // Same color the map style paints the ground, so the box doesn't flash
        // white while the first tiles load.
        bg="map.ground"
      >
        <LocationsMap
          apiKey={project.apiKey}
          locations={mapLocations}
          live={live}
          metric={metric}
          weighting={weighting}
          // Only the primary window: a pin is a badge over a place, with room for one
          // number. The cards print every picked window, out of the same record.
          history={levels?.[metric]}
          placing={placing}
          onPlacingChange={setPlacing}
          onCreateAt={setCreateAt}
          onSelect={select}
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
