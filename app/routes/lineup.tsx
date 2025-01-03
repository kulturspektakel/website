import {gql, useSuspenseQuery} from '@apollo/client';
import {FaChevronDown, FaChevronLeft} from 'react-icons/fa6';
import type {FlexProps} from '@chakra-ui/react';
import {
  Stack,
  Heading,
  IconButton,
  Flex,
  Text,
  Link as ChakraLink,
  Spinner,
  Center,
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
import {Tooltip} from '~/components/chakra-snippets/tooltip';
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
} from '~/components/chakra-snippets/menu';

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
            <Tooltip
              content={`Zum Lineup ${params.year}`}
              positioning={{placement: 'top-start'}}
            >
              <IconButton
                aria-label={`Zum Lineup ${params.year} zurückkehren`}
                size="xs"
                rounded="full"
                me="2"
                left="0"
                asChild
              >
                <NavLink
                  to={$path('/lineup/:year', {year: String(params.year)})}
                >
                  <FaChevronLeft />
                </NavLink>
              </IconButton>
            </Tooltip>
          )}
          <Heading as="h1" size="3xl" display="inline">
            Lineup
            {params?.year && <>&nbsp;{params.year}</>}
          </Heading>
          {params.slug == null && (
            <MenuRoot
              positioning={{placement: 'bottom-end'}}
              highlightedValue={params?.year}
            >
              <MenuTrigger asChild>
                <IconButton
                  aria-label="Jahr auswählen"
                  size="xs"
                  mt="0.5"
                  ml="1.5"
                  rounded="full"
                >
                  <FaChevronDown />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                <Suspense
                  fallback={
                    <Center my="10">
                      <Spinner />
                    </Center>
                  }
                >
                  <MenuItems />
                </Suspense>
              </MenuContent>
            </MenuRoot>
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

function BookingAlert(props: FlexProps) {
  return null;
  return (
    <InfoBox {...props} title="Jetzt Bewerben">
      <Text>
        Die Bewerbungsphase für das nächste Kulturspektakel läuft aktuell und
        ihr könnt euch jetzt für einen Auftritt bei uns{' '}
        <ChakraLink asChild variant="inline">
          <Link to={$path('/booking')}>bewerben</Link>
        </ChakraLink>
        .
      </Text>
    </InfoBox>
  );
}
