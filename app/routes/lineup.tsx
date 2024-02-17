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
  Text,
  Link as ChakraLink,
  Spinner,
  Center,
} from '@chakra-ui/react';
import {Link, NavLink, Outlet, useParams} from '@remix-run/react';
import {$path} from 'remix-routes';
import Search from '~/components/lineup/Search';
import type {LineupsQuery} from '~/types/graphql';
import {LineupsDocument} from '~/types/graphql';
import type {loader as rootLoader} from '~/root';
import {useTypedRouteLoaderData} from 'remix-typedjson';
import InfoBox from '~/components/InfoBox';
import {Suspense} from 'react';

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
  const root = useTypedRouteLoaderData<typeof rootLoader>('root')!;
  const event = root.eventsConnection.edges[0].node;

  return (
    (event.bandApplicationStart &&
      event.bandApplicationEnd &&
      event.bandApplicationStart.getTime() < Date.now() &&
      event.bandApplicationEnd.getTime() > Date.now()) ||
    (event.djApplicationStart &&
      event.djApplicationEnd &&
      event.djApplicationStart.getTime() < Date.now() &&
      event.djApplicationEnd.getTime() > Date.now())
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
                <Suspense
                  fallback={
                    <Center my="10">
                      <Spinner />
                    </Center>
                  }
                >
                  <MenuItems />
                </Suspense>
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
            year: node.start.getFullYear(),
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

  if (!applicationsOpen) {
    return null;
  }

  return (
    <InfoBox {...props} title="Jetzt Bewerben">
      <Text>
        Die Bewerbungsphase für das nächste Kulturspektakel läuft aktuell und
        ihr könnt euch jetzt für einen Auftritt bei uns{' '}
        <ChakraLink as={Link} to={$path('/booking')} variant="inline">
          bewerben
        </ChakraLink>
        .
      </Text>
    </InfoBox>
  );
}
