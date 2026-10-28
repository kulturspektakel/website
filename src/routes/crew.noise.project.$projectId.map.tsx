import {
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router';
import {Box, Text} from '@chakra-ui/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import LocationsMap, {type Coordinates} from '../components/noise/LocationsMap';
import {NoiseLocationDialog} from '../components/noise/NoiseLocationDialog';
import {AssignDeviceDialog} from '../components/noise/AssignDeviceDialog';
import {useWheelScrub} from '../components/noise/useWheelScrub';
import {
  locationLines,
  usePlayheadLevels,
  useProjectView,
  useReadingMinute,
} from '../components/noise/projectView';
import {ignoredDevicesAt, locationTags} from '../components/noise/rangeTags';
import {innermostAt} from '../components/noise/ranges';
import {
  formatDb,
  isRangeKey,
  primarySeries,
  rangeKey,
} from '../components/noise/level';
import {useTick} from '../components/noise/context';
import {
  exceedsLimit,
  limitLabel,
  strictestLimit,
  type LimitLine,
} from '../components/noise/limitLines';
import {seriesByKey, type SeriesKey} from '../components/noise/series';
import {rangeLeqs} from '../components/noise/projectLogs';

// Asks the map to open with the create tool armed — what the list's empty state sends,
// its one button being "add a location". In the history entry rather than the URL for the
// reason focusLocation is (see locationSelection.ts): it is the last thing pressed, not a
// view anyone would link to.
//
// `assignDevice` is the other way in with a job to do: a monitor's page, sending it here to
// be put somewhere. While it is set a press on a pin assigns that monitor there instead of
// opening the place's card, a new location is placed with it preselected, and either one
// returns to the monitor's page — which is where whoever pressed it was. Carried for the
// same reason as the other: it is what you came here to do, not a view to link to.
declare module '@tanstack/history' {
  interface HistoryState {
    placeLocation?: boolean;
    assignDevice?: string;
  }
}

export const Route = createFileRoute('/crew/noise/project/$projectId/map')({
  component: ProjectMapView,
});

function ProjectMapView() {
  const {projectId} = Route.useParams();
  const {
    project,
    live,
    range,
    picked,
    locations,
    rangeIndex,
    refresh,
    placing,
    setPlacing,
  } = useProjectView();
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
  // A sideways swipe over the map moves the playhead; the map's own zoom is untouched.
  const mapBox = useRef<HTMLDivElement | null>(null);
  useWheelScrub(mapBox);

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
  // The monitor this map was opened to place, if it was (see `assignDevice` above), and
  // the pin pressed for it — the confirmation open over the map.
  const assigning = useLocation({select: (l) => l.state.assignDevice});
  const [assignTo, setAssignTo] = useState<{
    id: string;
    locationName: string;
  } | null>(null);
  const select = useCallback(
    (locationId: string) => {
      if (assigning) {
        const location = project.locations.find((l) => l.id === locationId);
        if (location) setAssignTo(location);
        return;
      }
      void navigate({
        to: '/crew/noise/project/$projectId/list',
        params: {projectId},
        state: {focusLocation: locationId},
      });
    },
    [navigate, projectId, assigning, project.locations],
  );
  // Back where the errand started. A step of its own rather than a history back: the map
  // may have been reached through a redirect or a reload, and the device page is the one
  // place this is known to have come from.
  const backToDevice = useCallback(
    (device: string) =>
      navigate({to: '/crew/noise/device/$device', params: {device}}),
    [navigate],
  );

  // Escape drops the tool while it is waiting for a click, the way it would close anything
  // else that had taken over the pointer. Only then — once a point is picked the dialog is
  // up and Escape is the dialog's; closing it hands the map back still armed, and a second
  // Escape drops the tool from there. What says the tool is armed is the map itself: the
  // glow round it, the crosshair and the pin following the pointer (see LocationsMap).
  const waiting = placing && createAt == null;
  // Armed on arrival when that is what was asked for. An effect and not the layout's initial
  // state: the layout disarms the tool on every render of the list (see setPlacing), so it
  // can only be armed once this view is the one on screen.
  const placeOnArrival = useLocation({select: (l) => l.state.placeLocation});
  useEffect(() => {
    if (placeOnArrival) setPlacing(true);
  }, [placeOnArrival, setPlacing]);
  useEffect(() => {
    if (!waiting) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlacing(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [waiting, setPlacing]);

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
  // The minute the pins read — what decides whether a monitor is ignored (see
  // useReadingMinute).
  const pinsAt = useReadingMinute(live);

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
      locations.map(({location, assignments}) => {
        const deviceIds = assignments.map((a) => a.deviceId);
        return {
          ...location,
          deviceIds,
          // The monitors whose readings crew set aside at this instant: the pin leaves them
          // out of its number, and with nothing else standing there it says so instead.
          ignoredDeviceIds:
            pinsAt == null
              ? []
              : [
                  ...ignoredDevicesAt(
                    project.tags,
                    location.id,
                    deviceIds,
                    pinsAt,
                  ),
                ],
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
          // Whether a `Leq,T` limit in force at that minute was broken over its whole hours —
          // the reading the card's tile and the chart's wash go red on (see rangeLeqs). In the
          // weighting of the series the pin shows, `rangeIndex` holding no other.
          rangeOver:
            pinsAt != null &&
            location.limits.some(
              (limit) =>
                isRangeKey(limit.series) &&
                limit.start <= pinsAt &&
                pinsAt < limit.end &&
                rangeLeqs(rangeIndex, location.id, limit, limit).some((leq) =>
                  exceedsLimit(leq.db, leq.limit),
                ),
            ),
          // The limits in force at that minute, spelled out for the pin's hover: the
          // strictest on the series the pin shows, and on its weighting's `Leq,T`.
          limitsNow:
            pinsAt == null
              ? []
              : limitsInForce(location.limits, primary, pinsAt),
          // The comment this place is in at the minute the pins read — its own, the event's,
          // or a monitor's while it stood here (see locationTags) — printed under the pin.
          // The innermost, as the card's tile and the timeline pick (see innermostAt).
          comment:
            pinsAt == null
              ? undefined
              : (innermostAt(
                  locationTags(
                    project.tags,
                    location.id,
                    locationLines(location.assignments),
                  ).flatMap(({start, end, text}) =>
                    text && end != null ? [{start, end, text}] : [],
                  ),
                  pinsAt,
                )?.text ?? undefined),
        };
      }),
    [locations, primary, limitFrom, limitTo, project.tags, pinsAt, rangeIndex],
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
        ref={mapBox}
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
          placingLabel={assigning}
          onCreateAt={setCreateAt}
          onSelect={select}
        />
      </Box>

      <NoiseLocationDialog
        coordinates={createAt}
        projectId={projectId}
        window={project}
        device={assigning}
        // Abandoned, the tool is still armed: a cancel is most often a point picked a
        // little off, and the next click is the one meant. Only saving (below), the plus,
        // Escape or leaving the map put it back to being read-only.
        onClose={() => setCreateAt(null)}
        onCreated={async () => {
          await refresh();
          setCreateAt(null);
          setPlacing(false);
          if (assigning) await backToDevice(assigning);
        }}
      />
      {assigning && (
        <AssignDeviceDialog
          device={assigning}
          location={assignTo}
          window={project}
          onClose={() => setAssignTo(null)}
          onAssigned={async () => {
            await refresh();
            setAssignTo(null);
            await backToDevice(assigning);
          }}
        />
      )}
    </>
  );
}

// The limits a pin's place is held to at one instant, as its hover names them: the strictest
// in force on the series the pin shows, and the strictest on that series' weighting's
// `Leq,T` — the two a pin is judged by (see `limitDb` and `rangeOver`).
function limitsInForce(
  limits: readonly LimitLine[],
  series: SeriesKey,
  at: number,
): string[] {
  const range = rangeKey(seriesByKey(series).weighting);
  return [series, range].flatMap((key) => {
    const strictest = limits
      .filter((l) => l.series === key && l.start <= at && at < l.end)
      .sort((a, b) => a.decibels - b.decibels)[0];
    return strictest
      ? [
          `${limitLabel(strictest.series, strictest)} ≤ ${formatDb(strictest.decibels, 'dB')}`,
        ]
      : [];
  });
}
