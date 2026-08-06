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
import {assignableNoiseDevices, listNoiseProjects} from './crew.lautstaerke';
import {formatProjectRange} from '../components/lautstaerke/timeframe';
import {BluetoothMenu} from '../components/lautstaerke/BluetoothMenu';
import {DeviceRow} from '../components/lautstaerke/DeviceRow';
import {NoiseProjectDialog} from '../components/lautstaerke/NoiseProjectDialog';
import {noiseQueryKeys} from '../components/lautstaerke/queries';

type NoiseProjectItem = Awaited<ReturnType<typeof listNoiseProjects>>[number];

export const Route = createFileRoute('/crew/lautstaerke/')({
  loader: async () => {
    const [projects, unassigned] = await Promise.all([
      listNoiseProjects(),
      assignableNoiseDevices(),
    ]);
    return {projects, unassigned};
  },
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
  const {data: unassigned} = useQuery({
    queryKey: noiseQueryKeys.assignableDevices,
    queryFn: () => assignableNoiseDevices(),
    initialData: initial.unassigned,
  });

  return (
    <Box display="flex" flexDirection="column" flex="1" minH="0">
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

      {/* Devices are reached through a project's locations, so a monitor with no
          open assignment would otherwise appear nowhere at all — including every
          monitor before the first project exists. This lists only that
          otherwise-unreachable subset, and is empty in the steady state. */}
      {unassigned.length > 0 && (
        <>
          <Heading size="md" color="gray.500" mt="8" mb="3">
            Nicht zugewiesen
          </Heading>
          <VStack align="stretch" gap="2" pb="4">
            {unassigned.map((device) => (
              <DeviceRow
                key={device.id}
                deviceName={device.id}
                lastSeen={device.lastSeen}
              />
            ))}
          </VStack>
        </>
      )}

      <NoiseProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (projectId) => {
          await queryClient.invalidateQueries({queryKey: noiseQueryKeys.projects});
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
