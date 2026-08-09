import {createFileRoute, Link, useNavigate} from '@tanstack/react-router';
import {
  Box,
  Heading,
  HStack,
  IconButton,
  Span,
  Text,
  VStack,
} from '@chakra-ui/react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {FaChevronRight, FaPlus} from 'react-icons/fa6';
import {listNoiseProjects} from './crew.lautstaerke';
import {formatProjectRange} from '../components/lautstaerke/timeframe';
import {BluetoothMenu} from '../components/lautstaerke/BluetoothMenu';
import {NoiseProjectDialog} from '../components/lautstaerke/NoiseProjectDialog';
import {noiseQueryKeys} from '../components/lautstaerke/queries';

type NoiseProjectItem = Awaited<ReturnType<typeof listNoiseProjects>>[number];

export const Route = createFileRoute('/crew/lautstaerke/')({
  loader: async () => ({projects: await listNoiseProjects()}),
  component: NoiseProjectList,
});

function NoiseProjectList() {
  const initial = Route.useLoaderData();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);

  const {data: projects} = useQuery({
    queryKey: noiseQueryKeys.projects,
    queryFn: () => listNoiseProjects(),
    initialData: initial.projects,
  });

  return (
    // The area layout is edge-to-edge now (the project page is a map), so a page
    // that is a list of cards asks for its own gutter.
    <Box display="flex" flexDirection="column" flex="1" minH="0" p="4">
      <HStack mb="6" justify="space-between" align="center">
        <Heading as="h1" size="2xl">
          Lautstärke
        </Heading>
        <HStack gap="2">
          {/* Stays on the landing page: a freshly flashed monitor belongs to no
              project yet, and this is the only page reachable without first
              picking one. Connecting navigates to that device's page, where
              DeviceMenu offers the same calibrate/WLAN actions. */}
          <BluetoothMenu />
          <IconButton
            aria-label="Neues Projekt"
            borderRadius="full"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <FaPlus />
          </IconButton>
        </HStack>
      </HStack>

      {projects.length === 0 ? (
        <Text color="gray.500">Noch keine Projekte.</Text>
      ) : (
        <VStack align="stretch" gap="2">
          {projects.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </VStack>
      )}

      <NoiseProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (projectId) => {
          await queryClient.invalidateQueries({
            queryKey: noiseQueryKeys.projects,
          });
          setCreateOpen(false);
          // You create a project in order to put locations in it.
          await navigate({
            to: '/crew/lautstaerke/projekt/$projectId',
            params: {projectId},
          });
        }}
      />
    </Box>
  );
}

function ProjectRow({project}: {project: NoiseProjectItem}) {
  return (
    <HStack
      asChild
      p="3"
      gap="3"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.700"
      cursor="pointer"
      _hover={{bg: 'gray.800'}}
    >
      <Link
        to="/crew/lautstaerke/projekt/$projectId"
        params={{projectId: project.id}}
      >
        <Box flex="1" minW="0">
          <Text fontWeight="bold" truncate>
            {project.name}
          </Text>
          <Text fontSize="sm" color="gray.500">
            {formatProjectRange(project.start, project.end)} ·{' '}
            {project.locationCount === 1
              ? '1 Standort'
              : `${project.locationCount} Standorte`}
          </Text>
        </Box>
        <Span color="gray.500">
          <FaChevronRight />
        </Span>
      </Link>
    </HStack>
  );
}
