import {createFileRoute} from '@tanstack/react-router';
import {Text, VStack} from '@chakra-ui/react';
import {LocationCard} from '../components/lautstaerke/LocationCard';
import {useProjectView} from '../components/lautstaerke/projectView';

export const Route = createFileRoute(
  '/crew/lautstaerke/projekt/$projectId/liste',
)({
  component: ProjectListView,
});

function ProjectListView() {
  // Already resolved by the layout, monitors and all — see ProjectViewCtx.locations.
  const {project, locations} = useProjectView();

  if (locations.length === 0) {
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
      {locations.map(({location, assignments}) => (
        <LocationCard
          key={location.id}
          location={location}
          assignments={assignments}
        />
      ))}
    </VStack>
  );
}
