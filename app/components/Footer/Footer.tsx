import {
  Box,
  Flex,
  HStack,
  Link,
  VStack,
  Image,
  Text,
  useBreakpointValue,
} from '@chakra-ui/react';
import {Link as RemixLink, NavLink} from '@remix-run/react';
import {FaSpotify, FaYoutube, FaInstagram, FaFacebook} from 'react-icons/fa6';
import vpby from './vpby.svg';
import {$path} from 'remix-routes';

export default function Footer() {
  const iconSize = useBreakpointValue({base: 32, md: 24});
  return (
    <Flex
      as="footer"
      bgColor="brand.900"
      paddingY="8"
      paddingX={[8, 10, 16]}
      color="white"
      justify={'space-between'}
      direction={{base: 'column', md: 'row'}}
      gap={[8, 12, 20]}
      fontSize="sm"
    >
      <HStack alignItems="flex-start" maxW="500px">
        <Image
          src={'/logo.svg'}
          alt="Kulturspektakel Gauting Logo"
          w={10}
          display={{base: 'none', md: 'initial'}}
        />
        <VStack spacing="2" align={{base: 'center', md: 'flex-start'}}>
          <Text as="h2" fontSize="md">
            Kulturspektakel Gauting e.V.
          </Text>
          <Text textAlign={{base: 'center', md: 'left'}} lineHeight="1.2">
            Das Kult ist ein dreitägiges ehrenamtlich von Jugendlichen
            organisiertes Musikfestival in Gauting.
          </Text>
          <HStack
            color="offwhite.300"
            flexWrap={'wrap'}
            justifyContent={'center'}
          >
            <Link as={NavLink} to={$path('/booking')}>
              Booking
            </Link>
            <Link as={NavLink} to={$path('/:slug', {slug: 'impressum'})}>
              Impressum
            </Link>
            <Link as={NavLink} to={$path('/:slug', {slug: 'foerderverein'})}>
              Förderverein
            </Link>
            <Link as={NavLink} to={$path('/:slug', {slug: 'datenschutz'})}>
              Datenschutz
            </Link>
          </HStack>
        </VStack>
      </HStack>
      <VStack>
        <HStack gap={{base: 6, md: 4}}>
          <Link
            as={RemixLink}
            to="https://facebook.com/kulturspektakel"
            title="Facebook"
            target="_blank"
          >
            <FaFacebook size={iconSize} />
          </Link>
          <Link
            as={RemixLink}
            to="https://www.youtube.com/channel/UCLOU06fHSN3Hwe0rmbrFtpA"
            title="Youtube"
            target="_blank"
          >
            <FaYoutube size={iconSize} />
          </Link>
          <Link
            as={RemixLink}
            to="https://instagram.com/kulturspektakel"
            title="Instagram"
            target="_blank"
          >
            <FaInstagram size={iconSize} />
          </Link>
          <Link
            as={RemixLink}
            to="https://open.spotify.com/user/p7s6vlorvw05bxm881h5em4dj?si=4049483d01ec4fc3"
            title="Spotify"
            target="_blank"
          >
            <FaSpotify size={iconSize} />
          </Link>
        </HStack>
        <Box mt="2">
          Gefördert von
          <Link as={RemixLink} to="https://popkultur.bayern" target="_blank">
            <Image src={vpby} alt="Verband für Popkultur" />
          </Link>
        </Box>
      </VStack>
    </Flex>
  );
}
