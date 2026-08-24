import {
  createFileRoute,
  Outlet,
  retainSearchParams,
  useChildMatches,
} from '@tanstack/react-router';
import {AbsoluteCenter, Box, Spinner, Text} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {loadNoiseProject} from './crew.noise';
import {NoiseToolbar, ToolbarTitle} from '../components/noise/NoiseToolbar';
import {formatProjectRange} from '../components/noise/timeframe';
import {
  resolveProjectSelection,
  cropProjectSelection,
  sameSelection,
  setSelectionCurrent,
  visibleProjectWindow,
  type ProjectSelection,
} from '../components/noise/projectSelection';
import {
  projectSearchFor,
  projectSearchSelection,
  sameProjectSearch,
  validateProjectSearch,
} from '../components/noise/projectSearch';
import {useNowAfterMount} from '../components/noise/context';
import {
  assignmentsAt,
  orderLocations,
  createPlayheadSignal,
  PlayheadLevelsContext,
  PlayheadSignalContext,
  ProjectViewContext,
  type ProjectViewCtx,
} from '../components/noise/projectView';
import {ProjectTimeline} from '../components/noise/ProjectTimeline';
import {LevelPicker, useLevelPick} from '../components/noise/LevelPicker';
import {useProjectLogs} from '../components/noise/useProjectLogs';
import {
  NativeSelectField,
  NativeSelectRoot,
} from '../components/chakra-snippets/native-select';
import {Switch} from '../components/chakra-snippets/switch';
import {noiseQueryKeys} from '../components/noise/queries';
import {useLatest} from '../components/noise/chartUtils';
import {seo} from '../utils/seo';

// One view at a time: the map is only useful at a size worth giving the whole viewport
// to, and the cards below it were pushing it into a letterbox. Map and cards are
// sibling routes so a view is linkable and survives a reload, and so each one's markup
// lives in its own file; the shared toolbars, timeline and data stay here (see
// projectView.ts for what crosses the seam).
const MAP_ROUTE = '/crew/noise/project/$projectId/map';
const LIST_ROUTE = '/crew/noise/project/$projectId/list';

// Two choices over two routes, which is the whole of it: how wide the cards are is not a
// third view but a way of laying them out, and it is picked where the rest of the list's
// layout is — the toolbar at its foot, on the page it applies to, and remembered per browser
// rather than put on the URL (see listColumns.ts). This switcher used to carry it as a
// "Raster" entry, which put half of one view's layout in the header of both.
//
// The charts first, because that is where a project opens (see the index route) and a
// dropdown that led with something else would read as if the landing view were an
// exception. The map is a view you switch to.
const VIEWS = [
  {value: 'list', label: 'Graph', to: LIST_ROUTE},
  {value: 'map', label: 'Map', to: MAP_ROUTE},
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  to: string;
}>;

type View = (typeof VIEWS)[number]['value'];

// How long the timeline has to be still before the URL is brought up to date. Long enough
// that a drag or a hover across a chart is one write rather than a hundred, short enough
// that letting go and reaching for the address bar finds it already there.
const URL_SETTLE_MS = 300;

// `project/` is a static segment because $device already occupies the dynamic slot
// under /crew/noise — a cuid and a device name are indistinguishable at
// match time, so the two routes would be ambiguous. This also leaves every
// bookmarked device URL untouched.
export const Route = createFileRoute('/crew/noise/project/$projectId')({
  // Live, and the moment being looked at while it is off — see projectSearch.ts. On the
  // layout and not on either view, because the timeline is the layout's: both views are
  // read at the same instant, and switching between them must not change it.
  //
  // No loaderDeps, deliberately: none of this fetches anything. The project's stored
  // history is one query the browser then reads locally (see useProjectLogs), so pinning
  // a moment is not a reason to go back to the server.
  validateSearch: validateProjectSearch,
  // And they stay on the URL through every navigation inside this subtree that doesn't
  // mention them: switching view, and the index route's redirect into the list. Stated
  // once here, where the params are declared, rather than as a `search` to remember at
  // each link and redirect — the next one added would be the one that forgot.
  search: {middlewares: [retainSearchParams(['live', 'from', 'to'])]},
  loader: ({params}) => loadNoiseProject({data: {projectId: params.projectId}}),
  // Layout route: opts out of pending UI so its shell survives child navigation.
  // See the same line on `/_main` and `/crew`.
  pendingMs: Infinity,
  head: ({loaderData}) =>
    seo({title: `Noise – ${loaderData?.name ?? 'Project'}`}),
  component: NoiseProjectDetail,
});

function NoiseProjectDetail() {
  const {projectId} = Route.useParams();
  const initial = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  // Live is the default: this page's job during a festival is watching the monitors
  // right now, which is also what it did before there was a cursor. A URL that names a
  // moment is a page someone pinned and sent, so it opens on that instead.
  //
  // For a festival that is over — or hasn't started — live is an empty page, so it opens
  // on the whole event with the playhead at its end instead (see resolveProjectSelection,
  // which is what a live-less page with no crop resolves to). That rule lived on the index
  // route's links, which meant it held for exactly one way in: a bookmark, a pasted URL,
  // the index route's own redirect and every future link — a pin on the map, a device's
  // place chip — all opened a finished event live. It is a fact about the project, so it
  // belongs on the page that has the project.
  const [live, setLive] = useState(search.live !== false);
  // How you're looking at the project. Component state, because none of it fetches
  // anything — the whole event is in the browser — and because a gesture on the timeline
  // commits per animation frame, which is more often than an address bar can be written
  // (see the sync below). The URL is the record of it, not the source.
  //
  // `picked` is every series the charts draw — weighting included, there being no page-wide
  // weighting any more. It travels through the context, because the map and the list must
  // not answer it differently, and the single-number readouts take their one series off it
  // where they need one (see primarySeries). Not in the URL: it is how you read a chart, not
  // what you are looking at.
  const {picked, toggleSeries, rangeLeq, toggleRangeLeq} = useLevelPick();
  // What the user has picked of the timeline, or null while they have picked nothing —
  // see resolveProjectSelection for why that null carries weight. The crop comes from the
  // URL on the first render rather than from an effect after it, so a pinned link's own
  // window is what the first paint draws and hydration sees the same page the server
  // sent; the playhead inside it is the page's alone (see projectSearch.ts).
  const [chosen, setChosen] = useState<ProjectSelection | null>(() =>
    projectSearchSelection(search, null),
  );

  // The URL trails the page, and it trails it late. A crop drag commits once per animation
  // frame (see ProjectTimeline's useFrameCommit), so navigating per commit would
  // re-render every match sixty times a second — and spend Safari's history allowance, a
  // hundred entries per thirty seconds, in about two of them. So the pick lands in state
  // at once and in the URL once the gesture has been still for a moment. Nothing on the
  // page reads it back, so the delay is invisible; what it costs is a moment before the
  // URL is worth copying.
  //
  // That settling is what makes the history entry below worth having: one step per
  // gesture, rather than one per frame of it. Moving the playhead writes nothing at all —
  // it isn't in the URL — so hovering the charts neither navigates nor pushes.
  useEffect(() => {
    const next = projectSearchFor(live, chosen);
    if (sameProjectSearch(next, search)) return;
    const timer = setTimeout(
      () =>
        // Only the search changes, and `unsafeRelative` is what says so: with no `to`, a
        // navigation resolves against the route it was made from — this layout — and would
        // take the URL up out of the child view on screen, which the index route then
        // redirects back to the list. So touching the timeline on the map would bounce out
        // of the map. Against the current pathname instead, whatever it is.
        //
        // Over the search that is there rather than instead of it: `next` names every param
        // this page owns — including the ones it is clearing (see projectSearchFor) — and
        // says nothing about anybody else's.
        navigate({
          unsafeRelative: 'path',
          search: (prev) => ({...prev, ...next}),
          // A step of its own, not a replace: everything that reaches here is a decision
          // about what is being looked at — the mode, or a window someone framed — and
          // backing out of one is what a back button is for. Back walks out of live mode
          // and out through the crops that were picked; the adopt effect below is what
          // puts each of them on screen as it does.
          resetScroll: false,
        }),
      URL_SETTLE_MS,
    );
    return () => clearTimeout(timer);
    // The crop's two ends and not `chosen` itself: the playhead inside it moves once per
    // animation frame while a chart is hovered, and it is not in the URL — so depending on
    // the object would restart the settle sixty times a second and a long hover would
    // leave a crop that has already been let go of unwritten. The search is listed by its
    // three values for the same reason the adopt effect below is: this has to re-decide
    // when the URL moves under it, and not because a render handed it a new object.
  }, [
    live,
    chosen?.start,
    chosen?.end,
    search.live,
    search.from,
    search.to,
    navigate,
  ]);

  // And the other direction: the back button, or a link followed into a tab that is
  // already on this page. The URL changed without this page having written it, so the
  // page takes it — and equal values are dropped, since the page's own write arrives back
  // here as a change like any other and would otherwise hand every consumer a new
  // selection object for a selection that hasn't moved.
  useEffect(() => {
    setLive(search.live !== false);
    // The crop is only read back while the URL is showing one. Live carries no range by
    // construction, and the pick it leaves behind is deliberately kept in state so that
    // switching back returns to it — reading an absent range as "nothing picked" would
    // throw exactly that away.
    if (search.live === false) {
      setChosen((prev) => {
        // Around the playhead already standing there, which is why this is computed in the
        // updater rather than beside it: the URL says nothing about the instant, so the
        // one to keep is whatever the page holds at the moment it takes the crop.
        const next = projectSearchSelection(search, prev);
        return sameSelection(prev, next) ? prev : next;
      });
    }
    // The three values rather than the object: this must run when the URL moves, and not
    // because a render handed it a new identity for the same one.
  }, [search.live, search.from, search.to]);

  const {data: project} = useQuery({
    queryKey: noiseQueryKeys.project(projectId),
    queryFn: () => loadNoiseProject({data: {projectId}}),
    initialData: initial,
  });

  // Which view is on screen comes from the match, not from state — the URL is the one
  // place it's recorded. Anything that isn't the cards is the map; the index route is
  // neither, and redirects to the list before this is ever asked. The column count is
  // deliberately not read here: it is the list's own layout, and a switcher that changed
  // when it did would be a control for two different things.
  const shown = useChildMatches({
    select: (matches): View =>
      matches.some((m) => m.routeId === LIST_ROUTE) ? 'list' : 'map',
  });

  // Without a Maps key there is no map to switch to, so the list is all there is.
  const mapAvailable = project.apiKey != null;

  // Null for the first paint (see useNowAfterMount), so SSR falls back to the
  // project's own end and the clamp appears immediately after mount. Re-ticks
  // once a minute, so the edge keeps up during a running event.
  const now = useNowAfterMount();
  const pickable = visibleProjectWindow(project, now ?? project.end);

  // The other half of the opening decision above, and it has to be an effect for the same
  // reason `now` is null to begin with: the server has no business guessing which side of
  // the clock the reader is on, so the first paint opens live — as it always did — and the
  // clock corrects it once there is one.
  //
  // Once, ever. `now` re-ticks every minute and the guard is what keeps this an opening
  // decision rather than a rule: a festival that ends while someone is watching it live
  // must not throw them out of live mode as the clock passes its last minute.
  //
  // It runs after the adopt effect above has taken the URL, which is the order that makes
  // the two agree: an explicit `?live=` settles the question by itself and is claimed here
  // before this can look at a clock at all.
  const opened = useRef(search.live != null);
  useEffect(() => {
    if (opened.current || now == null) return;
    opened.current = true;
    if (now < project.start || now > project.end) setLive(false);
  }, [now, project.start, project.end]);
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
  //
  // Which is what makes the null — the pointer leaving — free on a page nobody has
  // touched yet: there was no playhead to take away, so the equality below keeps the
  // untouched pick and the crop goes on following the live edge.
  const scrubTo = useCallback(
    (at: number | null) => {
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
  const {levels, locationTotals, traces, gaps, isFetching} = useProjectLogs({
    projectId,
    live,
    picked,
    selection,
    // The raw locations with their whole assignment history, not the playhead-resolved
    // `locations` below: the crop Leq is summed over every minute a monitor stood at a
    // place, which has nothing to do with the instant being viewed. Everything it
    // returns is keyed by location id, so the order is immaterial — it takes the sorted
    // array only so there is one of them on the page.
    locations: ordered,
  });

  // Whether the cards are printing the crop's Leq at all: the menu's own pick, and a
  // timeframe to average over — which live mode has not, an instant being no range.
  //
  // Combined here and nowhere else, because this is the only place that holds both halves.
  // It used to be stated three times over: the picker re-derived it to make its "+N" count
  // agree with the cards, and a card gated on the raw pick and came out right about live
  // only because `useProjectLogs` happens to withhold `locationTotals` then — a correctness
  // resting on an unrelated layer's data-availability rule, which the first change to it
  // would have quietly broken.
  const showRangeLeq = rangeLeq && !live;

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
      picked,
      range,
      bounds,
      locations,
      scrubTo,
      cropTo,
      // Withheld rather than flagged: the reading is absent at the point it is *produced*,
      // so a card simply prints what it is given and no consumer — a pin, an export, the
      // next one — has to rediscover the gate. See showRangeLeq.
      locationTotals: showRangeLeq ? locationTotals : undefined,
      traces,
      refresh,
    }),
    [
      project,
      live,
      picked,
      range,
      bounds,
      locations,
      scrubTo,
      cropTo,
      showRangeLeq,
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
              // Both gone at phone width: the controls beside them need every pixel of
              // the strip, and neither line tells you anything you don't know — you
              // arrived here by picking this festival by name a moment ago. The back
              // arrow stays, so the way out of the page you are on is still there.
              title={
                <Box hideBelow="sm" w="full" minW="0">
                  <ToolbarTitle>{project.name}</ToolbarTitle>
                </Box>
              }
              // The project's dates: they say which festival this is, which is the same
              // thing its name does.
              sub={
                <Text truncate w="full" hideBelow="sm">
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
                    // The crop belongs to the charts: they are drawn over it and their Leqs
                    // averaged across it. The map has none — a pin reads what stood there at
                    // the playhead, off the whole payload rather than the crop — so the two
                    // grips there would pick a window nothing on screen answers to, over the
                    // one thing the map does want the strip for. The playhead stays in both.
                    //
                    // Nothing is lost switching to the map: the selection is this layout's,
                    // so the crop is still where it was left when the charts come back.
                    croppable={shown === 'list'}
                    // A prop rather than a field on the context below: the strip is the
                    // only thing that draws these, and the context is read by every card
                    // on the page (see ProjectViewCtx) — a field there would re-render all
                    // of them the moment the payload landed.
                    gaps={gaps}
                    // Straight into state: what the timeline hands back is exactly the
                    // override to remember, and pinning it is what stops an untouched
                    // crop from following the live edge any further. Identical values
                    // are dropped — every gesture snaps to the quarter hour, so
                    // consecutive frames of a drag often commit the same selection, and
                    // re-rendering the page for it would be pure waste.
                    onCommit={(next) =>
                      setChosen((prev) =>
                        sameSelection(prev, next) ? prev : next,
                      )
                    }
                  />
                )
              }
            >
              <LevelPicker
                live={live}
                picked={picked}
                rangeLeq={rangeLeq}
                rangeLeqShown={showRangeLeq}
                onToggleSeries={toggleSeries}
                onToggleRangeLeq={toggleRangeLeq}
              />
              {mapAvailable && (
                <NativeSelectRoot size="xs" w="auto">
                  <NativeSelectField
                    aria-label="View"
                    value={shown}
                    // The timeline and everything else page-wide survive the switch
                    // because the layout owns them and stays mounted — only the route
                    // travels. Not a replace: the view is part of the URL, and back should
                    // return to the one you came from.
                    //
                    // No search of its own, and neither view has one: the moment being looked
                    // at is the layout's and rides along on its retainSearchParams, and how
                    // the cards are laid out is remembered rather than travelling in the URL
                    // (see listColumns.ts) — so a trip to the map and back finds the list
                    // arranged the way it was left.
                    onChange={(e) => {
                      const view =
                        VIEWS.find((v) => v.value === e.target.value) ??
                        VIEWS[0];
                      navigate({
                        to: view.to,
                        params: {projectId},
                        search: {},
                      });
                    }}
                    items={VIEWS.map(({value, label}) => ({value, label}))}
                  />
                </NativeSelectRoot>
              )}
              {/* Last, hard against the right edge: it decides what the whole page is
                  doing, and the controls beside it only dress up what it lets through.

                  The one moment this page waits for anything: the project's whole history,
                  on the first switch out of live. A spinner stands in for the switch and
                  its caption while that arrives — the control being waited on is the one
                  that says so, rather than a second thing appearing beside it.

                  Relative, and the switch is hidden rather than unmounted, which is the
                  whole of how the strip holds still: the switch and the word under it go on
                  laying this item out at exactly the width they do the rest of the time, so
                  the spinner over them shoves nothing sideways and the controls to the left
                  don't shuffle along and back. `visibility` and not `opacity`, which would
                  leave a control that is invisible and still live under the spinner.
                  `disabled` alongside it says the same thing semantically — a hidden subtree
                  is already unfocusable — and is what the switch would need if it were ever
                  shown while waiting. Nothing else is torn down: the pins simply have no
                  number yet. */}
              <Box
                position="relative"
                display="flex"
                cursor={isFetching ? 'progress' : undefined}
              >
                <Switch
                  size="sm"
                  checked={live}
                  disabled={isFetching}
                  visibility={isFetching ? 'hidden' : undefined}
                  // The window survives the switch: every one of them exists in both
                  // modes (the finest simply gets finer), so there is nothing to reset.
                  onCheckedChange={(e) => setLive(e.checked)}
                  colorPalette="green"
                  // Stacked, with the word under the switch rather than beside it: it is
                  // the widest control in the strip and the one that has to survive a
                  // phone, and a caption costs height the strip already has to spare.
                  flexDirection="column"
                  gap="0.5"
                >
                  <Text
                    fontSize="2xs"
                    fontWeight="medium"
                    letterSpacing="wide"
                    color="fg"
                    lineHeight="1"
                  >
                    LIVE
                  </Text>
                </Switch>
                {isFetching && (
                  <AbsoluteCenter>
                    {/* Muted rather than the switch's green: green is what this control
                        says when live is *on*, and a green spinner in its place would read
                        as the state instead of as the wait for one. */}
                    <Spinner size="sm" color="fg.muted" />
                  </AbsoluteCenter>
                )}
              </Box>
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
