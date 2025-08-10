import {FaChevronDown, FaChevronLeft} from 'react-icons/fa6';
import {
  Stack,
  Heading,
  IconButton,
  Flex,
  Link as ChakraLink,
  Spinner,
  Center,
  Menu,
} from '@chakra-ui/react';
import Search from '../components/lineup/Search';
import {Suspense, useState} from 'react';
import {Tooltip} from '../components/chakra-snippets/tooltip';

import {Alert, AlertProps} from '../components/chakra-snippets/alert';
import {createFileRoute, Link, Outlet, useMatch} from '@tanstack/react-router';
import {prismaClient} from '../utils/prismaClient';
import {useSuspenseQuery} from '@tanstack/react-query';
import {createServerFn, useServerFn} from '@tanstack/react-start';

export const Route = createFileRoute('/lineup')({
  component: Lineup,
});

const lineups = createServerFn().handler(async () => {
  const lineups = await prismaClient.event.findMany({
    where: {
      eventType: 'Kulturspektakel',
      BandPlaying: {
        some: {},
      },
    },
    select: {
      id: true,
      name: true,
      start: true,
    },
    orderBy: {
      start: 'desc',
    },
  });

  return {
    lineups,
  };
});

function Lineup() {
  const event = Route.useRouteContext().event;
  const matchYear = useMatch({from: '/lineup/$year', shouldThrow: false});
  const matchSlug = useMatch({
    from: '/lineup/$year_/$slug',
    shouldThrow: false,
  });
  const year = matchYear?.params.year ?? matchSlug?.params.year;
  const slug = matchSlug?.params.slug;

  const bookingAlert =
    (event.bandApplicationStart &&
      event.bandApplicationEnd &&
      event.bandApplicationStart.getTime() < Date.now() &&
      event.bandApplicationEnd.getTime() > Date.now()) ||
    (event.djApplicationStart &&
      event.djApplicationEnd &&
      event.djApplicationStart.getTime() < Date.now() &&
      event.djApplicationEnd.getTime() > Date.now());

  return (
    <>
      <Stack
        direction={['column', 'row']}
        justifyContent="space-between"
        align={['start', 'center']}
      >
        <Flex alignItems="center" position="relative">
          {slug != null && (
            <Tooltip
              content={`Zum Lineup ${year}`}
              positioning={{placement: 'top-start'}}
            >
              <IconButton
                aria-label={`Zum Lineup ${year} zurückkehren`}
                size="2xs"
                rounded="full"
                me="1.5"
                left="0"
                asChild
              >
                <Link to="/lineup/$year" params={{year: year!}}>
                  <FaChevronLeft />
                </Link>
              </IconButton>
            </Tooltip>
          )}
          <Heading as="h1" size="3xl" display="inline">
            Lineup
            {year && <>&nbsp;{year}</>}
          </Heading>
          {slug == null && (
            <Menu.Root
              positioning={{placement: 'bottom-end'}}
              highlightedValue={year}
            >
              <Menu.Trigger asChild>
                <IconButton
                  aria-label="Jahr auswählen"
                  size="2xs"
                  ml="1.5"
                  rounded="full"
                >
                  <FaChevronDown />
                </IconButton>
              </Menu.Trigger>
              <Menu.Positioner>
                <Menu.Content>
                  <Suspense
                    fallback={
                      <Center my="10">
                        <Spinner />
                      </Center>
                    }
                  >
                    <MenuItems />
                  </Suspense>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
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
  const fetchLineups = useServerFn(lineups);
  const {data} = useSuspenseQuery({
    queryKey: ['lineups'],
    queryFn: fetchLineups,
  });
  return (
    <>
      {data.lineups.map((node) => (
        <Menu.Item
          asChild
          key={node.id}
          value={String(node.start.getFullYear())}
        >
          <Link
            to="/lineup/$year"
            params={{year: String(node.start.getFullYear())}}
          >
            {node.name}
          </Link>
        </Menu.Item>
      ))}
    </>
  );
}

function BookingAlert(props: AlertProps) {
  const [visisble, setVisisble] = useState(true);
  if (!visisble) {
    return null;
  }
  return (
    <Alert title="Jetzt bewerben" status="info" {...props}>
      Die Bewerbungsphase für das nächste Kulturspektakel läuft aktuell und ihr
      könnt euch jetzt für einen Auftritt bei uns{' '}
      <ChakraLink asChild>
        <Link to="/booking">bewerben</Link>
      </ChakraLink>
      .
    </Alert>
  );
}
