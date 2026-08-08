import {createFileRoute} from '@tanstack/react-router';
import {useMemo} from 'react';
import {Box, HStack, Text, VStack} from '@chakra-ui/react';
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
    traces,
    refresh,
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
    <VStack
      align="stretch"
      gap="2"
      p="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
    >
      <HStack justify="space-between" align="start" gap="3">
        <Box minW="0">
          <Text fontWeight="bold" truncate>
            {location.locationName}
          </Text>
          <Text fontFamily="mono" fontSize="xs" color="gray.500">
            {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
          </Text>
        </Box>
        {/* Assigning is a now-action, so it stays put however far back you scrub. */}
        <AssignDeviceMenu locationId={location.id} onAssigned={refresh} />
      </HStack>

      {assignments.length === 0 ? (
        <Text fontSize="sm" color="gray.500">
          {live ? 'Kein Gerät zugewiesen.' : 'Zu diesem Zeitpunkt kein Gerät.'}
        </Text>
      ) : (
        assignments.map((assignment) => (
          <DeviceRow
            key={assignment.id}
            deviceName={assignment.deviceId}
            locationName={location.locationName}
            lastSeen={assignment.lastSeen}
            live={live}
            metric={metric}
            weighting={weighting}
            historyDb={levels?.[assignment.deviceId]}
            chart={
              <DeviceRowChart
                device={assignment.deviceId}
                live={live}
                weighting={weighting}
                range={range}
                series={traces?.[assignment.deviceId]}
              />
            }
            action={
              // Only an open assignment can be ended; a row you scrubbed back to is
              // history, and offering to end it again would be nonsense.
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
  );
}
