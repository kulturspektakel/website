import {gql, useSuspenseQuery} from '@apollo/client';
import {TriangleDownIcon} from '@chakra-ui/icons';
import type {BoxProps} from '@chakra-ui/react';
import {
  Stack,
  Heading,
  MenuTrigger,
  Menu,
  MenuItem,
  IconButton,
  Flex,
  Tooltip,
  Text,
  Link as ChakraLink,
  Spinner,
  Center,
  Button,
} from '@chakra-ui/react';
import {Link, NavLink, Outlet, useParams} from '@remix-run/react';
import Search from '~/components/lineup/Search';
import type {BookingActiveQuery, LineupsQuery} from '~/types/graphql';
import {BookingActiveDocument, LineupsDocument} from '~/types/graphql';
import {typedjson, useTypedLoaderData} from 'remix-typedjson';
import InfoBox from '~/components/InfoBox';
import {Suspense} from 'react';
import {LoaderFunctionArgs} from '@remix-run/node';
import apolloClient from '~/utils/apolloClient';
import {$path} from 'remix-routes';

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

gql`
  query BookingActive {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          id
          bandApplicationStart
          bandApplicationEnd
          djApplicationStart
          djApplicationEnd
        }
      }
    }
  }
`;

export async function loader(args: LoaderFunctionArgs) {
  const {data} = await apolloClient.query<BookingActiveQuery>({
    query: BookingActiveDocument,
  });
  const event = data.eventsConnection.edges[0].node;
  return typedjson({
    bookingAlert:
      (event.bandApplicationStart &&
        event.bandApplicationEnd &&
        event.bandApplicationStart.getTime() < Date.now() &&
        event.bandApplicationEnd.getTime() > Date.now()) ||
      (event.djApplicationStart &&
        event.djApplicationEnd &&
        event.djApplicationStart.getTime() < Date.now() &&
        event.djApplicationEnd.getTime() > Date.now()),
  });
}

export default function () {
  const params = useParams();
  const bookingAlert = useTypedLoaderData<typeof loader>().bookingAlert;

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
                <MenuTrigger>
                  <Button
                    aria-label="Jahr auswählen"
                    size="xs"
                    mt="0.5"
                    ml="1.5"
                    rounded="full"
                    as={IconButton}
                  >
                    <TriangleDownIcon />
                    Jahr auswählen
                  </Button>
                </MenuTrigger>
              </Tooltip>
              <Suspense
                fallback={
                  <Center my="10">
                    <Spinner />
                  </Center>
                }
              >
                <MenuItems />
              </Suspense>
            </Menu>
          )}
        </Flex>
        {bookingAlert && <BookingAlert display={['flex', 'none']} />}
        <Search w={['100%', 'auto']} />
      </Stack>
      {bookingAlert && <BookingAlert display={['none', 'flex']} mt="4" />}
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
          asChild
          key={node.id}
          value={String(node.start.getFullYear())}
        >
          <NavLink
            to={$path('/lineup/:year', {
              year: node.start.getFullYear(),
            })}
          >
            {node.name}
          </NavLink>
        </MenuItem>
      ))}
    </>
  );
}

function BookingAlert(props: BoxProps) {
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
