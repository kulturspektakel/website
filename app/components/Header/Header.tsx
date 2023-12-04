import {
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  useToken,
} from '@chakra-ui/react';
import {useLocation, NavLink, useNavigation} from '@remix-run/react';
import i from './Header.webp';
import {useEffect, useMemo} from 'react';
import ProgressBar from '@badrap/bar-of-progress';

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

export default function Header() {
  const isHome = useLocation().pathname === '/';
  const isBooking = useLocation().pathname.startsWith('/booking');
  useLoadingBar();

  return (
    <Flex
      as="header"
      h={isHome ? 400 : ['60px', '60px', '90px']}
      p={[2, 2, 4]}
      justify="space-between"
      alignItems="flex-start"
      bgColor={isHome ? 'brand.900' : undefined}
      bgImage={isHome ? i : undefined}
      backgroundPosition="center"
      backgroundSize="contain"
      backgroundRepeat="no-repeat"
      bgBlendMode="luminosity"
    >
      <NavLink to="https://kulturspektakel.de">
        <Image
          src={'/logos/logo.svg'}
          alt="Kulturspektakel Gauting Logo"
          w="14"
        />
      </NavLink>

      <HStack
        as="nav"
        pr="3"
        spacing="8"
        h="14"
        fontFamily="Shrimp"
        fontSize={['sm', 'md', 'lg']}
        textTransform="uppercase"
        color={isHome ? 'white' : 'brand.900'}
        display={isBooking ? 'none' : 'flex'}
      >
        <ChakraLink
          as={NavLink}
          to="/angebot"
          _activeLink={{color: 'brand.500'}}
        >
          Angebot
        </ChakraLink>
        <ChakraLink
          as={NavLink}
          to="/lineup"
          _activeLink={{color: 'brand.500'}}
        >
          Lineup
        </ChakraLink>
        <ChakraLink
          as={NavLink}
          to="/events"
          _activeLink={{color: 'brand.500'}}
        >
          Veranstaltungen
        </ChakraLink>
        <ChakraLink as={NavLink} to="/infos" _activeLink={{color: 'brand.500'}}>
          Infos
        </ChakraLink>
      </HStack>
    </Flex>
  );
}
