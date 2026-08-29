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
import {primarySeries} from '../components/noise/level';
import {useTick} from '../components/noise/context';
import {strictestLimit} from '../components/noise/limitLines';

export const Route = createFileRoute('/crew/noise/project/$projectId/map')({
  component: ProjectMapView,
});

// A fixed id, so arming the tool twice replaces the prompt rather than stacking two.
const PLACE_TOAST = 'noise-place-location';

function ProjectMapView() {
  const {projectId} = Route.useParams();
  const {project, live, range, picked, locations, refresh} = useProjectView();
  // A pin has room for one number, so it reads the first of the picked set (see
  // primarySeries) — the same one every other single-number readout on the page follows.
  // On this view the set is a single series and the menu only lets it be one (see the
  // layout's pick), so the first of it is all of it; this stays the way it is read, because
  // the type is a set either way and primarySeries is the one rule for which of a set a
  // lone number comes out in.
  const primary = primarySeries(picked);
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

  // Which window a limit has to be in force over to be worth warning about, as the pair
  // strictestLimit takes. Scrubbing, that is the crop — the stretch of the evening the page
  // is about, and the very hours the cards draw their rules over, so the map and the list
  // warn against the same number. Live, it is this minute: the crop while live is the whole
  // event by default (nothing has picked one), and judging a reading arriving now against a
  // permit written for midnight would put a red pin over every stage all afternoon.
  //
  // A minute and not the second the levels move at, so the memo below survives the ~1/s
  // ticks a live map re-renders on: a limit is written to the minute at finest, so asking
  // any oftener could not change the answer.
  const minute = Math.floor(useTick(60_000) / 60_000) * 60_000;
  const [limitFrom, limitTo] = live
    ? [minute, minute + 1]
    : [range.start, range.end];

  // The map wants each location's monitors flattened, and its limit reduced to the one
  // figure a pin can be judged against; the list view keeps the assignments themselves,
  // since it renders one row each. Which monitors those are was already decided by the
  // layout — live means the ones standing there now, and scrubbing whoever stood there
  // then — so this only reshapes the answer, and inherits its identity: the memo holds
  // still through a scrub, and so does the memo'd map. A crop drag does move it, as it
  // moves which limits are in force.
  const mapLocations = useMemo(
    () =>
      locations.map(({location, assignments}) => ({
        ...location,
        deviceIds: assignments.map((a) => a.deviceId),
        // What the place is allowed to be, so the pin can say when it isn't. Against the
        // series the pin is actually showing, because a peak limit is not a bound on an Leq
        // (see strictestLimit) — which also means the header's menu is what brings a warning
        // into view, the same control that brings in the number being warned about.
        //
        // Undefined where nothing was written for those hours: a place with no limit is not
        // a place with a high one, and its pin stays a plain reading however loud.
        limitDb:
          strictestLimit(location.limits, primary, limitFrom, limitTo) ??
          undefined,
      })),
    [locations, primary, limitFrom, limitTo],
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
          // Only the primary series: a pin is a badge over a place, with room for one
          // number. The cards print every picked series, out of the same record.
          series={primary}
          history={levels?.[primary]}
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
