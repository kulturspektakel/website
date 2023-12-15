import {gql, useSuspenseQuery} from '@apollo/client';
import {TriangleDownIcon} from '@chakra-ui/icons';
import type {BoxProps} from '@chakra-ui/react';
import {
  Stack,
  Heading,
  MenuButton,
  Menu,
  MenuItem,
  MenuList,
  IconButton,
  Flex,
  Tooltip,
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Box,
  CloseButton,
  Link as ChakraLink,
  useDisclosure,
} from '@chakra-ui/react';
import {Link, NavLink, Outlet, useParams} from '@remix-run/react';
import {$path} from 'remix-routes';
import Search from '~/components/lineup/Search';
import type {LineupsQuery} from '~/types/graphql';
import {LineupsDocument} from '~/types/graphql';
import useRootData from '~/utils/useRootData';

gql`
  query Lineups {
    eventsConnection(type: Kulturspektakel, hasBandsPlaying: true, first: 100) {
      edges {
        node {
          name
          id
          start
        }
      }
    }
  }
`;

function useApplicationsOpen() {
  const root = useRootData();
  const event = root.eventsConnection.edges[0].node;

  return (
    (event.bandApplicationStart &&
      event.bandApplicationEnd &&
      new Date(event.bandApplicationStart).getTime() < Date.now() &&
      new Date(event.bandApplicationEnd).getTime() > Date.now()) ||
    (event.djApplicationStart &&
      event.djApplicationEnd &&
      new Date(event.djApplicationStart).getTime() < Date.now() &&
      new Date(event.djApplicationEnd).getTime() > Date.now())
  );
}

export default function () {
  const params = useParams();

  return (
    <>
      <Stack
        direction={['column', 'row']}
        justifyContent="space-between"
        align={['start', 'center']}
      >
        <Flex alignItems="center" position="relative">
          {params.slug != null && (
            <Tooltip label={`Zum Lineup ${params.year}`} placement="top-start">
              <IconButton
                aria-label={`Zum Lineup ${params.year} zurückkehren`}
                as={NavLink}
                to={$path('/lineup/:year', {year: String(params.year)})}
                icon={<TriangleDownIcon />}
                transform="rotate(90deg) translateY(120%)"
                size="xs"
                isRound={true}
                position="absolute"
                left="0"
              />
            </Tooltip>
          )}
          <Heading as="h1" display="inline">
            Lineup
            {params?.year && <>&nbsp;{params.year}</>}
          </Heading>
          {params.slug == null && (
            <Menu placement="bottom-end" isLazy>
              <Tooltip label="Jahr auswählen">
                <MenuButton
                  aria-label="Jahr auswählen"
                  size="xs"
                  mt="0.5"
                  ml="1.5"
                  isRound
                  as={IconButton}
                  icon={<TriangleDownIcon />}
                >
                  Jahr auswählen
                </MenuButton>
              </Tooltip>
              <MenuList>
                <MenuItems />
              </MenuList>
            </Menu>
          )}
        </Flex>
        <BookingAlert display={['flex', 'none']} />
        <Search w={['100%', 'auto']} />
      </Stack>
      <BookingAlert display={['none', 'flex']} mt="4" />
      <Outlet />
    </>
  );
}

function MenuItems() {
  const {data} = useSuspenseQuery<LineupsQuery>(LineupsDocument, {});
  return (
    <>
      {data?.eventsConnection.edges.map(({node}) => (
        <MenuItem
          as={NavLink}
          to={$path('/lineup/:year', {
            year: new Date(node.start).getFullYear(),
          })}
          key={node.id}
        >
          {node.name}
        </MenuItem>
      ))}
    </>
  );
}

function BookingAlert(props: BoxProps) {
  const applicationsOpen = useApplicationsOpen();
  const {isOpen, onClose} = useDisclosure({defaultIsOpen: true});

  if (!applicationsOpen || !isOpen) {
    return null;
  }

  return (
    <Alert borderRadius="lg" bg="offwhite.200" alignItems="start" {...props}>
      <AlertIcon color="brand.900" />
      <Box>
        <AlertTitle fontFamily="Shrimp" textTransform="uppercase">
          Jetzt bewerben!
        </AlertTitle>
        <AlertDescription>
          Die Bewerbungsphase für das nächste Kulturspektakel läuft aktuell und
          ihr könnt euch jetzt für einen Auftritt bei uns{' '}
          <ChakraLink as={Link} to={$path('/booking')} variant="inline">
            bewerben
          </ChakraLink>
          .
        </AlertDescription>
      </Box>
      <CloseButton
        alignSelf="flex-start"
        position="relative"
        right={-1}
        top={-1}
        onClick={onClose}
      />
    </Alert>
  );
}
