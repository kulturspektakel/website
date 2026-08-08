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
import {useCallback, useMemo, useState} from 'react';
import {LuArrowLeft} from 'react-icons/lu';
import {loadNoiseProject} from './crew.lautstaerke';
import {formatProjectRange} from '../components/lautstaerke/timeframe';
import {
  resolveProjectSelection,
  visibleProjectWindow,
  type ProjectSelection,
} from '../components/lautstaerke/projectSelection';
import {useNowAfterMount} from '../components/lautstaerke/context';
import {
  ProjectViewContext,
  type ProjectViewCtx,
} from '../components/lautstaerke/projectView';
import {ProjectTimeline} from '../components/lautstaerke/ProjectTimeline';
import {LevelPicker} from '../components/lautstaerke/LevelPicker';
import {useProjectLogs} from '../components/lautstaerke/useProjectLogs';
import {isPointMetric, type LevelMetric} from '../components/lautstaerke/level';
import {type Weighting} from '../components/lautstaerke/noise';
import {SegmentedControlOrSelect} from '../components/SegmentedControlOrSelect';
import {Switch} from '../components/chakra-snippets/switch';
import {noiseQueryKeys} from '../components/lautstaerke/queries';
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
  // object every render: the selection is handed to every consumer through context,
  // so a new identity per render would be a new context value per render.
  const selection = useMemo(
    () => resolveProjectSelection(chosen, pickable),
    [chosen, pickable.start, pickable.end],
  );

  // Which instant the page is looking at: an instant while scrubbing, and null while
  // live, meaning "whatever is standing there now". Decided here rather than in each
  // view, so the map and the list can't answer it differently.
  const viewedAt = live ? null : selection.current;

  // One request for the project's whole stored history, and then nothing: every
  // number below is read out of it locally, so the timeline and both dropdowns cost
  // no round trip. Skipped entirely while live.
  const {levels, traces, isFetching} = useProjectLogs({
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
      selection,
      viewedAt,
      levels,
      traces,
      refresh,
    }),
    [project, live, metric, weighting, selection, levels, traces, refresh],
  );

  return (
    <ProjectViewContext.Provider value={view}>
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
              onCheckedChange={(e) => {
                setLive(e.checked);
                // Live is an instant, so there is no range to average over it: fall
                // back to the finest window rather than blanking every pin.
                if (e.checked && !isPointMetric(metric)) setMetric('eq_fast');
              }}
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
              onWeighting={setWeighting}
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
    </ProjectViewContext.Provider>
  );
}
