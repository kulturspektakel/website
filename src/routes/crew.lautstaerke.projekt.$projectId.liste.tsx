import {createFileRoute} from '@tanstack/react-router';
import {useMemo} from 'react';
import {Box, Collapsible, HStack, Text, VStack} from '@chakra-ui/react';
import {LuChevronDown} from 'react-icons/lu';
import {DeviceRow} from '../components/lautstaerke/DeviceRow';
import {DeviceRowChart} from '../components/lautstaerke/DeviceRowChart';
import {
  AssignDeviceMenu,
  AssignmentMenu,
} from '../components/lautstaerke/AssignDeviceMenu';
import {
  assignmentsAt,
  useProjectView,
  type NoiseLocationItem,
} from '../components/lautstaerke/projectView';

export const Route = createFileRoute(
  '/crew/lautstaerke/projekt/$projectId/liste',
)({
  component: ProjectListView,
});

function ProjectListView() {
  const {project} = useProjectView();

  if (project.locations.length === 0) {
    return (
      <Text color="gray.500">
        {/* A location can only be placed on the map, so without a Maps key there
            is no way in at all — say so rather than showing an empty list and no
            control. */}
        {project.apiKey != null
          ? 'Noch keine Standorte.'
          : 'Noch keine Standorte. Ohne Google-Maps-Schlüssel ist die Karte nicht verfügbar, daher können derzeit keine Standorte angelegt werden.'}
      </Text>
    );
  }

  return (
    <VStack align="stretch" gap="3" pb="4">
      {project.locations.map((location) => (
        <LocationCard key={location.id} location={location} />
      ))}
    </VStack>
  );
}

// Everything page-wide comes from the context rather than down through the list:
// this renders inside the very provider ProjectListView read from, and threading the
// display settings would mean a third place to edit for every one added.
function LocationCard({location}: {location: NoiseLocationItem}) {
  const {
    live,
    metric,
    weighting,
    selection,
    viewedAt,
    levels,
    totals,
    traces,
    refresh,
    scrubTo,
    cropTo,
  } = useProjectView();
  // A row is a monitor that stood here at the instant being viewed — which while live
  // means one standing here now, and while scrubbing may be one that has since moved
  // on. The whole assignment history is on the client, so this is just a filter.
  const assignments = assignmentsAt(location.assignments, viewedAt);
  // The crop alone, so a row chart's data-push effect doesn't see a new object every
  // render — the playhead moving is none of its business.
  const range = useMemo(
    () => ({start: selection.start, end: selection.end}),
    [selection.start, selection.end],
  );

  return (
    // Chakra's own disclosure rather than a `useState` and a conditional: it owns the
    // trigger/content wiring (aria-expanded, aria-controls, the ids) and the height
    // transition, none of which is worth hand-rolling per card.
    //
    // unmountOnExit, because the content is charts: left mounted they would each keep
    // a uPlot instance alive and reposition a playhead on every frame anyone hovers a
    // row anywhere on the page, so a closed card would cost as much as an open one.
    // Rebuilding on expand is cheap at this size. Open to begin with — a list you have
    // to unfold before it says anything is a worse first paint than a long one.
    <Collapsible.Root
      defaultOpen
      unmountOnExit
      display="flex"
      flexDirection="column"
      gap="2"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      <HStack justify="space-between" align="start" gap="3">
        {/* The whole title block is the trigger rather than a chevron button beside
            it: at phone width a lone icon is a target you miss, and there is nothing
            else in the block that wants a click of its own. The assign menu stays
            outside it, so it keeps its own click and the two don't nest.
            Laid out on the trigger itself rather than `asChild` onto an HStack, which
            would merge it onto a div and quietly drop the button — its focus, its
            Enter and Space. */}
        <Collapsible.Trigger
          flex="1"
          minW="0"
          display="flex"
          alignItems="center"
          gap="2"
          textAlign="left"
          cursor="pointer"
        >
          <Collapsible.Indicator
            color="gray.400"
            flexShrink="0"
            display="flex"
            // Pointing right when closed, down when open — one icon rotated, which
            // is what makes it animate rather than swap.
            rotate={{base: '-90deg', _open: '0deg'}}
            transition="rotate 0.2s"
          >
            <LuChevronDown />
          </Collapsible.Indicator>
          <Box minW="0">
            <Text fontWeight="bold" truncate>
              {location.locationName}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
            </Text>
          </Box>
        </Collapsible.Trigger>
        {/* Assigning is a now-action, so it stays put however far back you scrub. */}
        <AssignDeviceMenu locationId={location.id} onAssigned={refresh} />
      </HStack>

      <Collapsible.Content>
        <VStack align="stretch" gap="2">
          {assignments.length === 0 ? (
            <Text fontSize="sm" color="gray.500">
              {live
                ? 'Kein Gerät zugewiesen.'
                : 'Zu diesem Zeitpunkt kein Gerät.'}
            </Text>
          ) : (
            assignments.map((assignment) => (
              <DeviceRow
                key={assignment.id}
                deviceName={assignment.deviceId}
                lastSeen={assignment.lastSeen}
                live={live}
                metric={metric}
                weighting={weighting}
                historyDb={levels?.[assignment.deviceId]}
                total={totals?.[assignment.deviceId]}
                chart={
                  <DeviceRowChart
                    device={assignment.deviceId}
                    live={live}
                    // The header's window — the same one the traces were built for,
                    // and the same one the coloured number on the row is read in.
                    metric={metric}
                    weighting={weighting}
                    range={range}
                    // viewedAt rather than selection.current, so the line marks
                    // exactly the instant the numbers beside it were read at — and so
                    // live mode, which reads no instant at all, draws none.
                    current={viewedAt}
                    // Hovering any row moves the page's playhead, which is what puts
                    // the line in the same place on every other row's chart and on
                    // the timeline. Withheld while live for the same reason there is
                    // no line then: there is nothing for it to move.
                    onScrub={live ? undefined : scrubTo}
                    // `i`/`o` over the trace, or a drag across it, crop the page's
                    // timeframe to what was pointed at. Withheld while live for the
                    // same reason as the playhead: the window follows the clock then,
                    // and a crop inside it would be overwritten a second later.
                    onCrop={live ? undefined : cropTo}
                    series={traces?.[assignment.deviceId]}
                  />
                }
                action={
                  // Only an open assignment can be ended; a row you scrubbed back to
                  // is history, and offering to end it again would be nonsense.
                  assignment.end == null ? (
                    <AssignmentMenu
                      assignmentId={assignment.id}
                      onEnded={refresh}
                    />
                  ) : undefined
                }
              />
            ))
          )}
        </VStack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
