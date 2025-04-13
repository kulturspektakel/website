import {
  Flex,
  Image,
  Link as ChakraLink,
  useToken,
  Text,
  Box,
  Center,
  IconButton,
  HStack,
  VStack,
  DialogRoot,
  DialogContent,
  DialogBackdrop,
} from '@chakra-ui/react';
import {Link, useLocation, useNavigate} from '@tanstack/react-router';
import {useEffect, useMemo, useState} from 'react';
import ProgressBar from '@badrap/bar-of-progress';
import logo from './logo.svg';
import videoSrc from './Header.mov';
import DateString from '../DateString';
import {FaXmark, FaBars} from 'react-icons/fa6';

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
  // const {state} = useNavigation();
  // useEffect(() => {
  //   if (state === 'loading' || state === 'submitting') {
  //     progress.start();
  //   } else {
  //     progress.finish();
  //   }
  // }, [progress, state]);
}

function Item({children, to}: {children: React.ReactNode; to: string}) {
  return (
    <ChakraLink
      asChild
      color="inherit"
      _focus={{
        outline: 'none',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      }}
      lineHeight={1}
    >
      <Link to={to}>
        {({isActive, isTransitioning}) => (
          <Text color={isActive || isTransitioning ? 'brand.500' : undefined}>
            {children}
          </Text>
        )}
      </Link>
    </ChakraLink>
  );
}

function NavItems() {
  return (
    <>
      <Item to="/angebot">Angebot</Item>
      <Item to="/lineup">Lineup</Item>
      <Item to="/events">Veranstaltungen</Item>
      <Item to="/infos">Infos</Item>
    </>
  );
}

export default function Header({
  event,
}: {
  event: {
    start: Date;
    end: Date;
  };
}) {
  const isHome = useLocation().pathname === '/';
  const [showNav, setShowNav] = useState(false);
  // Close nav on route change
  useLoadingBar();
  const navigate = useNavigate();

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
            objectFit="contain"
            maxH="50%"
            onContextMenu={(e) => {
              e.preventDefault();
              navigate({
                to: '/logo',
              });
            }}
          />
          {event && (
            <Box
              fontFamily="Shrimp"
              px="4"
              py="1"
              lineHeight="120%"
              color="black"
              transform="rotate(-2deg)"
              fontSize={[30, 35, 40]}
              textTransform="uppercase"
              bg="white"
              whiteSpace="nowrap"
              mt="2"
              mixBlendMode="lighten"
              zIndex={2}
            >
              <DateString
                options={{month: 'long', year: 'numeric', day: '2-digit'}}
                date={event.start}
                to={event.end}
                until="-"
              />
            </Box>
          )}
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
          rounded="full"
          onClick={() => setShowNav(true)}
          display={['flex', 'none']}
        >
          <FaBars />
        </IconButton>
        <HStack
          as="nav"
          pr="3"
          gap={['4', '4', '8']}
          h="14"
          fontFamily="Shrimp"
          fontSize={['sm', 'lg', 'xl']}
          textTransform="uppercase"
          color={isHome ? 'white' : 'brand.900'}
          display={['none', 'flex']}
        >
          <NavItems />
        </HStack>
      </Flex>
      <DialogRoot
        open={showNav}
        onOpenChange={({open}) => !open && setShowNav(false)}
        motionPreset="none"
        size="full"
      >
        <DialogBackdrop bgColor="brand.900" opacity={1} />
        <DialogContent
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
            gap="8"
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
              rounded="full"
              onClick={() => setShowNav(false)}
            >
              <FaXmark />
            </IconButton>
          </Flex>
        </DialogContent>
      </DialogRoot>
    </Flex>
  );
}

function Logo() {
  const navigate = useNavigate();
  return (
    <Link
      to="/"
      onContextMenu={(e) => {
        e.preventDefault();
        navigate({
          to: '/logo',
        });
      }}
    >
      <Image
        src={'/logos/logo.svg'}
        alt="Kulturspektakel Gauting Logo"
        w="14"
      />
    </Link>
  );
}
