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
import {useMemo, useState} from 'react';
import {FaChevronRight, FaPlus} from 'react-icons/fa6';
import {listNoiseProjects, noiseMonitorDevices} from './crew.lautstaerke';
import {formatProjectRange} from '../components/lautstaerke/timeframe';
import {BluetoothMenu} from '../components/lautstaerke/BluetoothMenu';
import {DeviceRow} from '../components/lautstaerke/DeviceRow';
import {NoiseProjectDialog} from '../components/lautstaerke/NoiseProjectDialog';
import {
  NoiseToolbar,
  ToolbarTitle,
} from '../components/lautstaerke/NoiseToolbar';
import {compareDeviceIds} from '../components/lautstaerke/noise';
import {noiseQueryKeys} from '../components/lautstaerke/queries';

type NoiseProjectItem = Awaited<ReturnType<typeof listNoiseProjects>>[number];

export const Route = createFileRoute('/crew/lautstaerke/')({
  // Both at once: two independent reads, and serially they would be two round trips
  // deep on every navigation here.
  loader: async () => {
    const [projects, devices] = await Promise.all([
      listNoiseProjects(),
      noiseMonitorDevices(),
    ]);
    return {projects, devices};
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

  // Straight from the loader, deliberately not through react-query like the projects
  // above. The client sets refetchOnMount: false (see __root) and initialData only
  // applies to an empty cache entry, so a session that had already opened the device
  // picker would serve that entry here and never refresh it — and a placement made on a
  // project page would still read as the old one on coming back. The router's stale time
  // is 0, so this loader re-runs on every navigation instead, and nothing on this page
  // mutates devices for anything to invalidate.
  //
  // Sorted the way a person reads the names — kult-2 before kult-10, which Postgres's
  // ordering does not give us. Same collator everywhere a set of monitors is shown, so a
  // list and a row of badges cannot disagree about the order.
  const devices = useMemo(
    () => [...initial.devices].sort((a, b) => compareDeviceIds(a.id, b.id)),
    [initial.devices],
  );

  return (
    // Grows past the viewport rather than being clamped to it, so the toolbar can stick
    // to the area layout's scroll box — the same wrapper the project and device pages
    // use, and for the same reason.
    <Box display="flex" flexDirection="column" flex="1 0 auto">
      <NoiseToolbar
        // The one page the arrow would point at is this one.
        back={false}
        title={<ToolbarTitle>Lautstärke</ToolbarTitle>}
      >
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
      </NoiseToolbar>

      {/* The gutter sits here rather than on the page, so the strip above stays
          edge-to-edge: what is below is a list of cards, which asks for one. */}
      <Box display="flex" flexDirection="column" flex="1" minH="0" p="4">
        {projects.length === 0 ? (
          <Text color="fg.subtle">Noch keine Projekte.</Text>
        ) : (
          <VStack align="stretch" gap="2">
            {projects.map((project) => (
              <ProjectRow key={project.id} project={project} />
            ))}
          </VStack>
        )}

        {/* Every monitor, under the events they are deployed at: the set is small and
            long-lived, so this is a list of the hardware rather than of anything that
            happened, and it is the only way to a monitor that belongs to no project.
            Monitors appear once they have first reported in — one that has never
            authenticated has no row to list. */}
        <Heading size="md" color="fg.muted" mt="8" mb="3">
          Geräte
        </Heading>
        {devices.length === 0 ? (
          <Text color="fg.subtle">Noch keine Geräte.</Text>
        ) : (
          <VStack align="stretch" gap="2">
            {devices.map((device) => (
              <DeviceRow key={device.id} device={device} />
            ))}
          </VStack>
        )}
      </Box>

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
      borderColor="border.emphasized"
      cursor="pointer"
      _hover={{bg: 'bg.emphasized'}}
    >
      <Link
        to="/crew/lautstaerke/projekt/$projectId"
        params={{projectId: project.id}}
        // No `live`, deliberately: a link that named it was this list deciding, for the one
        // way in it happens to own, something the project page can decide for every way in.
        // It has the project's own window and now applies the rule itself, so the plain URL
        // is the whole of what a row has to say — see the layout route's `opened` effect.
      >
        <Box flex="1" minW="0">
          <Text fontWeight="bold" truncate>
            {project.name}
          </Text>
          <Text fontSize="sm" color="fg.subtle">
            {formatProjectRange(project.start, project.end)} ·{' '}
            {project.locationCount === 1
              ? '1 Standort'
              : `${project.locationCount} Standorte`}
          </Text>
        </Box>
        <Span color="fg.subtle">
          <FaChevronRight />
        </Span>
      </Link>
    </HStack>
  );
}
