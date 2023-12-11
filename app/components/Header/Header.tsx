import {
  Flex,
  Image,
  Link as ChakraLink,
  useToken,
  Box,
  Center,
  IconButton,
  Hide,
  Collapse,
  HStack,
  VStack,
} from '@chakra-ui/react';
import {useLocation, NavLink, useNavigation} from '@remix-run/react';
import {useEffect, useMemo, useState} from 'react';
import ProgressBar from '@badrap/bar-of-progress';
import logo from './logo.svg';
import videoSrc from './Header.mov';
import DateString from '../DateString';
import {CloseIcon, HamburgerIcon} from '@chakra-ui/icons';
import {$path} from 'remix-routes';

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
  return (
    <>
      <ChakraLink
        as={NavLink}
        to={$path('/angebot')}
        _activeLink={{color: 'brand.500'}}
      >
        Angebot
      </ChakraLink>
      <ChakraLink
        as={NavLink}
        to={$path('/lineup')}
        _activeLink={{color: 'brand.500'}}
      >
        Lineup
      </ChakraLink>
      <ChakraLink
        as={NavLink}
        to={$path('/events')}
        _activeLink={{color: 'brand.500'}}
      >
        Veranstaltungen
      </ChakraLink>
      <ChakraLink
        as={NavLink}
        to={$path('/infos')}
        _activeLink={{color: 'brand.500'}}
      >
        Infos
      </ChakraLink>
    </>
  );
}

export default function Header() {
  const isHome = useLocation().pathname === '/';
  const isBooking = useLocation().pathname.startsWith('/booking');
  const [showNav, setShowNav] = useState(true);
  useLoadingBar();

  return (
    <Flex
      as="header"
      position="relative"
      w="100%"
      h={isHome ? 700 : ['60px', '60px', '90px']}
      bgColor={isHome ? 'brand.900' : undefined}
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
              date={new Date('2024-07-19')}
              to={new Date('2024-07-21')}
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
        zIndex={3}
        w="100%"
      >
        <NavLink to="https://kulturspektakel.de">
          <Image
            src={'/logos/logo.svg'}
            alt="Kulturspektakel Gauting Logo"
            w="14"
          />
        </NavLink>
        <Hide above="sm">
          <IconButton
            aria-label="Navigation öffnen"
            isRound={true}
            icon={showNav ? <CloseIcon /> : <HamburgerIcon fontSize="xl" />}
            onClick={() => setShowNav((s) => !s)}
          />
        </Hide>
        <Hide below="md">
          <HStack
            as="nav"
            pr="3"
            spacing="8"
            h="14"
            fontFamily="Shrimp"
            fontSize={['sm', 'lg', 'xl']}
            textTransform="uppercase"
            color={isHome ? 'white' : 'brand.900'}
            display={isBooking ? 'none' : 'flex'}
          >
            <NavItems />
          </HStack>
        </Hide>
      </Flex>
      <Box w="100%" h="100%" position="relative" zIndex={2}>
        <Collapse in={showNav} animateOpacity>
          <VStack
            color="white"
            fontSize="lg"
            fontFamily="Shrimp"
            textTransform="uppercase"
            justify="center"
            bgColor="brand.900"
            pt="14"
            pb="14"
          >
            <NavItems />
          </VStack>
        </Collapse>
      </Box>
    </Flex>
  );
}
