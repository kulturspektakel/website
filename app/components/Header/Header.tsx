import type {LinkProps, SystemStyleObject} from '@chakra-ui/react';
import {
  Flex,
  Image,
  Link as ChakraLink,
  useToken,
  Box,
  Center,
  IconButton,
  HStack,
  VStack,
  Modal,
  ModalContent,
  ModalOverlay,
} from '@chakra-ui/react';
import {useLocation, NavLink, useNavigation} from '@remix-run/react';
import {useEffect, useMemo, useState} from 'react';
import ProgressBar from '@badrap/bar-of-progress';
import logo from './logo.svg';
import videoSrc from './Header.mov';
import DateString from '../DateString';
import {CloseIcon, HamburgerIcon} from '@chakra-ui/icons';
import {$path} from 'remix-routes';
import type {RemixNavLinkProps} from '@remix-run/react/dist/components';
import {gql} from '@apollo/client';
import type {HeaderFragment} from '~/types/graphql';

gql`
  fragment Header on Query {
    eventsConnection(first: 1, type: Kulturspektakel) {
      edges {
        node {
          start
          end
        }
      }
    }
  }
`;

function useLoadingBar() {
  const [blue500] = useToken('colors', ['blue.500']);
  const progress = useMemo(
    () =>
      new ProgressBar({
        size: 2,
        color: blue500,
        delay: 80,
      }),
    [blue500],
  );
  const {state} = useNavigation();
  useEffect(() => {
    if (state === 'loading' || state === 'submitting') {
      progress.start();
    } else {
      progress.finish();
    }
  }, [progress, state]);
}

function NavItems() {
  const _focus: SystemStyleObject = {
    outline: 'none',
    color: 'brand.500',
  };
  const _activeLink: SystemStyleObject = {
    borderBottom: '3px solid',
    marginBottom: '-3px',
  };

  const props: Omit<RemixNavLinkProps & LinkProps, 'to'> = {
    _focus,
    _focusVisible: _focus,
    _hover: _focus,
    _activeLink,
    lineHeight: 1,
    as: NavLink,
  };

  return (
    <>
      <ChakraLink to={$path('/angebot')} {...props}>
        Angebot
      </ChakraLink>
      <ChakraLink to={$path('/lineup')} {...props}>
        Lineup
      </ChakraLink>
      <ChakraLink to={$path('/events')} {...props}>
        Veranstaltungen
      </ChakraLink>
      <ChakraLink to={$path('/infos')} {...props}>
        Infos
      </ChakraLink>
    </>
  );
}

export default function Header(props: {data: HeaderFragment}) {
  const isHome = useLocation().pathname === '/';
  const isBooking = useLocation().pathname.startsWith('/booking');
  const [showNav, setShowNav] = useState(true);
  const {state} = useNavigation();
  // Close nav on route change
  useEffect(() => setShowNav(false), [state]);
  useLoadingBar();

  return (
    <Flex
      as="header"
      position="relative"
      w="100%"
      h={isHome ? 700 : ['60px', '60px', '90px']}
      bgColor={isHome ? 'brand.900' : undefined}
      mb={isHome ? '8' : undefined}
    >
      {isHome && (
        <Center
          position="absolute"
          left={0}
          right={0}
          top={0}
          bottom={0}
          flexDirection="column"
        >
          <video
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            controls={false}
            style={{
              transition: 'opacity 1s ease-out',
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
            }}
          />
          <Image
            src={logo}
            alt="Kulturspektakel Gauting Logo"
            zIndex={2}
            w={['80%', '60%', '40%']}
          />
          <Box
            fontFamily="Shrimp"
            px="4"
            color="black"
            transform="rotate(-2deg)"
            fontSize={['30', '35', '40']}
            textTransform="uppercase"
            bg="white"
            whiteSpace="nowrap"
            mt="2"
            mixBlendMode="lighten"
            zIndex={2}
          >
            <DateString
              options={{month: 'long', year: 'numeric', day: '2-digit'}}
              date={props.data.eventsConnection.edges[0].node.start}
              to={props.data.eventsConnection.edges[0].node.end}
              until="-"
            />
          </Box>
          <Box
            bgColor="brand.900"
            position="absolute"
            left={0}
            right={0}
            top={0}
            bottom={0}
            opacity={0.4}
          />
        </Center>
      )}
      <Flex
        p={[2, 2, 4]}
        left={0}
        right={0}
        top={0}
        justify="space-between"
        alignItems="center"
        position="absolute"
        w="100%"
      >
        <Logo />
        <IconButton
          aria-label="Navigation öffnen"
          isRound={true}
          icon={<HamburgerIcon fontSize="xl" />}
          onClick={() => setShowNav(true)}
          display={['block', 'none']}
        />
        <HStack
          as="nav"
          pr="3"
          spacing="8"
          h="14"
          fontFamily="Shrimp"
          fontSize={['sm', 'lg', 'xl']}
          textTransform="uppercase"
          color={isHome ? 'white' : 'brand.900'}
          display={isBooking ? 'none' : ['none', 'flex']}
        >
          <NavItems />
        </HStack>
      </Flex>
      <Modal
        isOpen={showNav}
        onClose={() => setShowNav(false)}
        motionPreset="scale"
        size="full"
      >
        <ModalOverlay bg="brand.900" backdropFilter="blur(10px)" />
        <ModalContent
          bgColor="transparent"
          boxShadow="none"
          // reversed, so that nav items are focused first
          flexDirection="column-reverse"
        >
          <VStack
            color="white"
            fontSize="xl"
            fontFamily="Shrimp"
            textTransform="uppercase"
            justify="center"
            height="100%"
            spacing="8"
            flexGrow={1}
            pb="16"
          >
            <NavItems />
          </VStack>
          <Flex
            p={[2, 2, 4]}
            justify="space-between"
            alignItems="center"
            w="100%"
          >
            <Logo />
            <IconButton
              aria-label="Navigation schließen"
              isRound={true}
              icon={<CloseIcon fontSize="xl" />}
              onClick={() => setShowNav(false)}
            />
          </Flex>
        </ModalContent>
      </Modal>
    </Flex>
  );
}

function Logo() {
  return (
    <NavLink to="https://kulturspektakel.de">
      <Image
        src={'/logos/logo.svg'}
        alt="Kulturspektakel Gauting Logo"
        w="14"
      />
    </NavLink>
  );
}
