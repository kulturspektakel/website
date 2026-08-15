import {createFileRoute, Outlet, useChildMatches} from '@tanstack/react-router';
import {Box, Spinner, Text} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {loadNoiseProject} from './crew.lautstaerke';
import {
  NoiseToolbar,
  ToolbarTitle,
} from '../components/lautstaerke/NoiseToolbar';
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
  orderLocations,
  createPlayheadSignal,
  PlayheadLevelsContext,
  PlayheadSignalContext,
  ProjectViewContext,
  type ProjectViewCtx,
} from '../components/lautstaerke/projectView';
import {ProjectTimeline} from '../components/lautstaerke/ProjectTimeline';
import {LevelPicker, useLevelPick} from '../components/lautstaerke/LevelPicker';
import {useProjectLogs} from '../components/lautstaerke/useProjectLogs';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {Switch} from '../components/chakra-snippets/switch';
import {noiseQueryKeys} from '../components/lautstaerke/queries';
import {useLatest} from '../components/lautstaerke/chartUtils';
import {seo} from '../utils/seo';

// One view at a time: the map is only useful at a size worth giving the whole viewport
// to, and the cards below it were pushing it into a letterbox. Map and cards are
// sibling routes so a view is linkable and survives a reload, and so each one's markup
// lives in its own file; the shared toolbars, timeline and data stay here (see
// projectView.ts for what crosses the seam).
//
// Three choices over two routes: the list and the grid are the same route at one or two
// columns, which travels as that route's own `spalten` search param. So a view is a
// route *and* a search, and picking one navigates to both.
const MAP_ROUTE = '/crew/lautstaerke/projekt/$projectId/karte';
const LIST_ROUTE = '/crew/lautstaerke/projekt/$projectId/liste';

// The list first, because that is where a project opens (see the index route) and a
// dropdown that led with something else would read as if the landing view were an
// exception. The map is a view you switch to.
const VIEWS = [
  {value: 'list', label: 'Liste', to: LIST_ROUTE, search: {}},
  {value: 'grid', label: 'Raster', to: LIST_ROUTE, search: {spalten: 2}},
  {value: 'map', label: 'Karte', to: MAP_ROUTE, search: {}},
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  to: string;
  search: {spalten?: 2};
}>;

type View = (typeof VIEWS)[number]['value'];

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
  //
  // One pick, two halves: `metrics` is every window the charts draw, `metric` the primary
  // the numbers are read in (see primaryMetric). Both travel through the context, because
  // the map and the list must not answer either of them differently.
  const {weighting, setWeighting, metrics, metric, toggleMetric} =
    useLevelPick();
  // What the user has picked of the timeline, or null while they have picked nothing —
  // see resolveProjectSelection for why that null carries weight.
  const [chosen, setChosen] = useState<ProjectSelection | null>(null);

  const {data: project} = useQuery({
    queryKey: noiseQueryKeys.project(projectId),
    queryFn: () => loadNoiseProject({data: {projectId}}),
    initialData: initial,
  });

  // Which view is on screen comes from the match and its search, not from state — the
  // URL is the one place it's recorded. Anything that isn't the cards is the map; the
  // index route is neither, and redirects to the list before this is ever asked.
  const shown = useChildMatches({
    select: (matches): View => {
      const list = matches.find((m) => m.routeId === LIST_ROUTE);
      if (!list) return 'map';
      return (list.search as {spalten?: number}).spalten === 2
        ? 'grid'
        : 'list';
    },
  });

  // Without a Maps key there is no map to switch to, so the list is all there is.
  const mapAvailable = project.apiKey != null;

  // Null for the first paint (see useNowAfterMount), so SSR falls back to the
  // project's own end and the clamp appears immediately after mount. Re-ticks
  // once a minute, so the edge keeps up during a running event.
  const now = useNowAfterMount();
  const pickable = visibleProjectWindow(project, now ?? project.end);
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

  // And the strip the crop lives in, pinned the same way and for the same reason:
  // `pickable` is a fresh object every render, and this one goes through the context to
  // every card as the limit a pinch or a two-finger drag may reach. Its right edge moves
  // once a minute on a running festival, which is a new value then and only then.
  const bounds = useMemo(
    () => ({start: pickable.start, end: pickable.end}),
    [pickable.start, pickable.end],
  );

  // Which monitors stood at each location at the instant being viewed, resolved once
  // for the whole page rather than per card and again in the map.
  //
  // The key is what makes a scrub free: hovering a trace re-resolves this on every
  // frame and, for all but the handful that cross an assignment boundary, gets back
  // exactly the same rows. Keyed on the rows' ids and not on their devices, because two
  // abutting assignments of one monitor are two different rows — and one of them is
  // closed, which is what decides whether the ⋮ offers to end it.
  //
  // Sorted before any of that, and here rather than in each view: the cards, the roster
  // of chips under them and the pins on the map are three renderings of one set, and
  // there is exactly one place that decides its order (see compareLocations). Not left
  // to the query either — Postgres sorts `Bühne 10` before `Bühne 2`.
  const ordered = useMemo(
    () => orderLocations(project.locations),
    [project.locations],
  );
  const locationsKey = ordered
    .map(
      (l) =>
        `${l.id}:${assignmentsAt(l.assignments, viewedAt)
          .map((a) => a.id)
          .join(',')}`,
    )
    .join('|');
  // `ordered` is a dependency as well as the key, and has to be: a refetch after an
  // assignment change hands back an equal-but-new graph carrying the same ids, so a memo
  // watching the key alone would go on serving the previous render's rows, with the
  // lastSeen and the open/closed flag they had before the change that caused the
  // refetch. viewedAt is deliberately absent — the key already says when it matters.
  const locations = useMemo(
    () =>
      ordered.map((location) => ({
        location,
        assignments: assignmentsAt(location.assignments, viewedAt),
      })),
    [locationsKey, ordered],
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
  // number below is read out of it locally, so the timeline and both pickers cost
  // no round trip. Skipped entirely while live.
  const {levels, locationTotals, traces, isFetching} = useProjectLogs({
    projectId,
    live,
    metrics,
    metric,
    weighting,
    selection,
    // The raw locations with their whole assignment history, not the playhead-resolved
    // `locations` below: the crop Leq is summed over every minute a monitor stood at a
    // place, which has nothing to do with the instant being viewed. Everything it
    // returns is keyed by location id, so the order is immaterial — it takes the sorted
    // array only so there is one of them on the page.
    locations: ordered,
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
      metrics,
      metric,
      weighting,
      range,
      bounds,
      locations,
      scrubTo,
      cropTo,
      locationTotals,
      traces,
      refresh,
    }),
    [
      project,
      live,
      metrics,
      metric,
      weighting,
      range,
      bounds,
      locations,
      scrubTo,
      cropTo,
      locationTotals,
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
          {/* Grows past the viewport rather than being clamped to it — `1 0 auto`, not
              `1`. A sticky child can only stick within its own parent, so a page box
              exactly one viewport tall would let the toolbars scroll away the moment a
              long list ran past it. At least the viewport (so the map has a full one to
              fill), and as tall as the list when there is more. */}
          <Box display="flex" flexDirection="column" flex="1 0 auto">
            <NoiseToolbar
              title={<ToolbarTitle>{project.name}</ToolbarTitle>}
              // The project's dates: they say which festival this is, which is the same
              // thing its name does.
              sub={
                <Text truncate w="full">
                  {formatProjectRange(project.start, project.end)}
                </Text>
              }
              below={
                /* A second toolbar, and only while scrubbing. Live mode reads what is
                   arriving now — there is no instant to point at and no crop to pick, so
                   the strip had nothing left to do but take up the room the map wants.
                   The selection it edits is not lost with it: the layout owns it, so
                   switching back returns to the crop and the instant you left. */
                !live && (
                  <ProjectTimeline
                    window={pickable}
                    selection={selection}
                    // Straight into state: what the timeline hands back is exactly the
                    // override to remember, and pinning it is what stops an untouched
                    // crop from following the live edge any further. Identical values
                    // are dropped — every gesture snaps to the quarter hour, so
                    // consecutive frames of a drag often commit the same selection, and
                    // re-rendering the page for it would be pure waste.
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
                )
              }
            >
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
              {isFetching && <Spinner size="xs" color="fg.subtle" />}
              <LevelPicker
                live={live}
                weighting={weighting}
                metrics={metrics}
                onWeighting={setWeighting}
                onToggleMetric={toggleMetric}
              />
              {mapAvailable && (
                <NativeSelectRoot size="xs" w="auto">
                  <NativeSelectField
                    aria-label="Ansicht"
                    value={shown}
                    // The timeline and everything else page-wide survive the switch
                    // because the layout owns them and stays mounted — only the
                    // route and its columns travel. Not a replace: the view is part
                    // of the URL, and back should return to the one you came from.
                    onChange={(e) => {
                      const view =
                        VIEWS.find((v) => v.value === e.target.value) ??
                        VIEWS[0];
                      navigate({
                        to: view.to,
                        params: {projectId},
                        search: view.search,
                      });
                    }}
                    items={VIEWS.map(({value, label}) => ({value, label}))}
                  />
                </NativeSelectRoot>
              )}
            </NoiseToolbar>

            {/* Everything the toolbars left over, edge to edge: the map fills it, and
                the list sets its own gutter. No padding and no frame here — a border
                around the map would draw a box inside a box, and the one thing this
                page is for is seeing the site. */}
            <Box flex="1" minH="0" display="flex" flexDirection="column">
              <Outlet />
            </Box>
          </Box>
        </PlayheadLevelsContext.Provider>
      </PlayheadSignalContext.Provider>
    </ProjectViewContext.Provider>
  );
}
