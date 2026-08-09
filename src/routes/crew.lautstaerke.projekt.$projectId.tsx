import {
  createFileRoute,
  Link,
  Outlet,
  useChildMatches,
} from '@tanstack/react-router';
import {
  Box,
  Heading,
  HStack,
  IconButton,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {LuArrowLeft} from 'react-icons/lu';
import {loadNoiseProject} from './crew.lautstaerke';
import {formatProjectRange} from '../components/lautstaerke/timeframe';
import {
  resolveProjectSelection,
  cropProjectSelection,
  setSelectionCurrent,
  visibleProjectWindow,
  type ProjectSelection,
} from '../components/lautstaerke/projectSelection';
import {useNowAfterMount} from '../components/lautstaerke/context';
import {
  assignmentsAt,
  createPlayheadSignal,
  PlayheadLevelsContext,
  PlayheadSignalContext,
  ProjectViewContext,
  type ProjectViewCtx,
} from '../components/lautstaerke/projectView';
import {ProjectTimeline} from '../components/lautstaerke/ProjectTimeline';
import {LevelPicker} from '../components/lautstaerke/LevelPicker';
import {useProjectLogs} from '../components/lautstaerke/useProjectLogs';
import {
  supportedMetric,
  type LevelMetric,
} from '../components/lautstaerke/level';
import {type Weighting} from '../components/lautstaerke/noise';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {Switch} from '../components/chakra-snippets/switch';
import {noiseQueryKeys} from '../components/lautstaerke/queries';
import {useLatest} from '../components/lautstaerke/chartUtils';
import {seo} from '../utils/seo';

// Either/or rather than both: the map is only useful at a size worth giving the
// whole viewport to, and the cards below it were pushing it into a letterbox.
// The two are sibling routes so a view is linkable and survives a reload, and so
// each one's markup lives in its own file; the shared header, timeline and data
// stay here (see projectView.ts for what crosses the seam).
const VIEW_ROUTES = {
  map: '/crew/lautstaerke/projekt/$projectId/karte',
  list: '/crew/lautstaerke/projekt/$projectId/liste',
} as const;

type View = keyof typeof VIEW_ROUTES;
const VIEWS: Array<{value: View; label: string}> = [
  {value: 'map', label: 'Karte'},
  {value: 'list', label: 'Liste'},
];

// `projekt/` is a static segment because $device already occupies the dynamic slot
// under /crew/lautstaerke — a cuid and a device name are indistinguishable at
// match time, so the two routes would be ambiguous. This also leaves every
// bookmarked device URL untouched.
export const Route = createFileRoute('/crew/lautstaerke/projekt/$projectId')({
  loader: ({params}) => loadNoiseProject({data: {projectId: params.projectId}}),
  head: ({loaderData}) =>
    seo({title: `Lautstärke – ${loaderData?.name ?? 'Projekt'}`}),
  component: NoiseProjectDetail,
});

function NoiseProjectDetail() {
  const {projectId} = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  // Live is the default: this page's job during a festival is watching the
  // monitors right now, which is also what it did before there was a cursor.
  const [live, setLive] = useState(true);
  // How you're looking at the project, all of it component state: none of it fetches
  // anything, because the whole event is in the browser. Only *which view* is on
  // screen is in the URL, and that's a route.
  const [weighting, setWeighting] = useState<Weighting>('A');
  const [metric, setMetric] = useState<LevelMetric>('eq_fast');
  // What the user has picked of the timeline, or null while they have picked nothing —
  // see resolveProjectSelection for why that null carries weight.
  const [chosen, setChosen] = useState<ProjectSelection | null>(null);

  const {data: project} = useQuery({
    queryKey: noiseQueryKeys.project(projectId),
    queryFn: () => loadNoiseProject({data: {projectId}}),
    initialData: initial,
  });

  // Which view is on screen comes from the match, not from state — the URL is
  // the one place it's recorded. Anything that isn't the list is the map,
  // including the index route, which redirects to it.
  const shown = useChildMatches({
    select: (matches): View =>
      matches.some((m) => m.routeId === VIEW_ROUTES.list) ? 'list' : 'map',
  });

  // Without a Maps key there is no map to switch to, so the list is all there is.
  const mapAvailable = project.apiKey != null;

  // Null for the first paint (see useNowAfterMount), so SSR falls back to the
  // project's own end and the clamp appears immediately after mount. Re-ticks
  // once a minute, so the edge keeps up during a running event.
  const now = useNowAfterMount();
  const pickable = visibleProjectWindow(project, now ?? project.end);
  const cappedToNow = pickable.end < project.end;
  // Memoized on the window's ends rather than on `pickable` itself, which is a fresh
  // object every render: the timeline's props, `range` and selectionRef are all derived
  // from this, and a new identity per render would put a new one in front of each.
  const selection = useMemo(
    () => resolveProjectSelection(chosen, pickable),
    [chosen, pickable.start, pickable.end],
  );

  // Which instant the page is looking at: an instant while scrubbing, and null while
  // live, meaning "whatever is standing there now". Decided here rather than in each
  // view, so the map and the list can't answer it differently.
  const viewedAt = live ? null : selection.current;

  // The crop alone, pinned on its two ends: it is handed to every card through the
  // context, and a fresh object per render would be a new context value on every frame
  // of a hover — which is the one thing the split below exists to prevent.
  const range = useMemo(
    () => ({start: selection.start, end: selection.end}),
    [selection.start, selection.end],
  );

  // Which monitors stood at each location at the instant being viewed, resolved once
  // for the whole page rather than per card and again in the map.
  //
  // The key is what makes a scrub free: hovering a trace re-resolves this on every
  // frame and, for all but the handful that cross an assignment boundary, gets back
  // exactly the same rows. Keyed on the rows' ids and not on their devices, because two
  // abutting assignments of one monitor are two different rows — and one of them is
  // closed, which is what decides whether the ⋮ offers to end it.
  const locationsKey = project.locations
    .map(
      (l) =>
        `${l.id}:${assignmentsAt(l.assignments, viewedAt)
          .map((a) => a.id)
          .join(',')}`,
    )
    .join('|');
  // `project.locations` is a dependency as well as the key, and has to be: a refetch
  // after an assignment change hands back an equal-but-new graph carrying the same ids,
  // so a memo watching the key alone would go on serving the previous render's rows,
  // with the lastSeen and the open/closed flag they had before the change that caused
  // the refetch. viewedAt is deliberately absent — the key already says when it matters.
  const locations = useMemo(
    () =>
      project.locations.map((location) => ({
        location,
        assignments: assignmentsAt(location.assignments, viewedAt),
      })),
    [locationsKey, project.locations],
  );

  // Read by scrubTo so it can start from the selection in effect without depending on
  // it: hovering a row chart fires once per animation frame, and a callback that
  // changed identity with the playhead would put a new context value — and so a fresh
  // chart prop — in front of every consumer on every one of those frames.
  const selectionRef = useLatest(selection);
  // Same reason: the window's right edge follows the clock on a running festival, and
  // the bound setter below must not change identity when it ticks.
  const pickableRef = useLatest(pickable);

  // Hovering a row chart is the same commit dragging the playhead makes, so it goes
  // to the same place: an override, which is also what pins the crop from following
  // the live edge any further. An unchanged instant keeps whatever was there before —
  // that's most frames of a slow hover, and it also means merely passing the pointer
  // over the playhead where it already stands doesn't pin an untouched timeline.
  const scrubTo = useCallback(
    (at: number) => {
      setChosen((prev) => {
        const from = selectionRef.current;
        const next = setSelectionCurrent(from, at);
        return next.current === from.current ? prev : next;
      });
    },
    [selectionRef],
  );

  // Cropping from a row chart: the in/out keys hand over one end, a drag across the
  // trace both. One commit either way — exact, never snapped, and a single state
  // update, so a drag can't briefly put a start past an end.
  const cropTo = useCallback(
    (crop: {start?: number; end?: number}) => {
      setChosen((prev) =>
        cropProjectSelection(
          crop,
          prev ?? selectionRef.current,
          pickableRef.current,
        ),
      );
    },
    [selectionRef, pickableRef],
  );

  // One request for the project's whole stored history, and then nothing: every
  // number below is read out of it locally, so the timeline and both dropdowns cost
  // no round trip. Skipped entirely while live.
  const {levels, totals, traces, isFetching} = useProjectLogs({
    projectId,
    live,
    metric,
    weighting,
    selection,
  });

  // Assigning or ending changes both this project's locations and which devices
  // are still available, on this page and on the index.
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: noiseQueryKeys.project(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: noiseQueryKeys.assignableDevices,
      }),
      queryClient.invalidateQueries({queryKey: noiseQueryKeys.projects}),
    ]);
  }, [queryClient, projectId]);

  const view = useMemo<ProjectViewCtx>(
    () => ({
      project,
      live,
      metric,
      weighting,
      range,
      locations,
      scrubTo,
      cropTo,
      totals,
      traces,
      refresh,
    }),
    [
      project,
      live,
      metric,
      weighting,
      range,
      locations,
      scrubTo,
      cropTo,
      totals,
      traces,
      refresh,
    ],
  );

  // One signal for the layout's lifetime, so the subscription every row chart holds
  // never has to be torn down and re-established. Pushed from an effect rather than
  // during render: the charts move a line to a pixel, and the scale that pixel is
  // measured against is set by their own effects, which run first.
  const [playheadSignal] = useState(createPlayheadSignal);
  useEffect(() => playheadSignal.set(viewedAt), [playheadSignal, viewedAt]);

  return (
    <ProjectViewContext.Provider value={view}>
      {/* The signal outside the readings, because it never changes and they do —
          see PlayheadSignalContext. */}
      <PlayheadSignalContext.Provider value={playheadSignal.subscribe}>
        <PlayheadLevelsContext.Provider value={levels}>
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
              {/* Wraps rather than squeezing: four controls is more than a phone's
              header width, and the heading beside them already takes what it needs. */}
              <HStack gap="3" flexShrink="0" wrap="wrap" justify="flex-end">
                <Switch
                  size="sm"
                  checked={live}
                  // The window survives the switch: every one of them exists in both
                  // modes (the finest simply gets finer), so there is nothing to reset.
                  onCheckedChange={(e) => setLive(e.checked)}
                  colorPalette="green"
                >
                  <Text fontSize="sm">Live</Text>
                </Switch>
                {/* The one moment this page waits for anything: the project's whole
                history, on the first switch out of live. Nothing is torn down while
                it loads — the pins simply have no number yet. */}
                {isFetching && <Spinner size="xs" color="gray.500" />}
                <LevelPicker
                  live={live}
                  weighting={weighting}
                  metric={metric}
                  onWeighting={(next) => {
                    setWeighting(next);
                    // Switching to dB(A) with LCpeak selected leaves the picker pointing
                    // at a series that doesn't exist, which everything downstream resolves
                    // through the series table and would trip over. So the pick follows
                    // the weighting to its nearest kin.
                    setMetric((m) => supportedMetric(m, next));
                  }}
                  onMetric={setMetric}
                />
                {mapAvailable && (
                  <SegmentedControlOrSelect
                    size="xs"
                    value={shown}
                    // The timeline survives the switch because the layout owns it and
                    // stays mounted — nothing travels in the URL. Not a replace: the view
                    // is part of the URL, and back should return to the one you came from.
                    onValueChange={(e) =>
                      navigate({
                        to: VIEW_ROUTES[e.value as View],
                        params: {projectId},
                      })
                    }
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
                // Straight into state: what the timeline hands back is exactly the
                // override to remember, and pinning it is what stops an untouched crop
                // from following the live edge any further. Identical values are dropped —
                // every gesture snaps to the quarter hour, so consecutive frames of a drag
                // often commit the same selection, and re-rendering the page for it would
                // be pure waste.
                onCommit={(next) =>
                  setChosen((prev) =>
                    prev &&
                    prev.start === next.start &&
                    prev.end === next.end &&
                    prev.current === next.current
                      ? prev
                      : next,
                  )
                }
              />
            </Box>

            <Outlet />
          </Box>
        </PlayheadLevelsContext.Provider>
      </PlayheadSignalContext.Provider>
    </ProjectViewContext.Provider>
  );
}
