import { Box, Flex, HStack, Link, VStack, Image, Text } from '@chakra-ui/react';
import { Link as RemixLink } from '@remix-run/react';
import { FaSpotify, FaYoutube, FaInstagram, FaFacebook } from 'react-icons/fa6';
import vpby from './vpby.svg';

export default function Footer() {
  // const x= 0;
  return (
    <Flex
      as="footer"
      bgColor="brand.900"
      paddingY={8}
      paddingX={[8, 10, 16]}
      color="white"
      justify={'space-between'}
      gap={[12, 12, 20]}
    >
      <HStack alignItems={"flex-start"}>
        <Image src={"/logo.svg"} alt="Kulturspektakel Gauting Logo" w={10} />
        <VStack align={"left"}>
          <Text as="h2" >Kulturspektakel Gauting e.V.</Text>
          <Text>Das Kult ist ein dreitägiges ehrenamtlich von Jugendlichen organisiertes Musikfestival in Gauting.</Text>
          <HStack color="offwhite.500" >
            <Link as={RemixLink} to="/booking">
              Booking
            </Link>
            <Link as={RemixLink} to="/impressum">
              Impressum
            </Link>
            <Link as={RemixLink} to="/foerderverein">
              Förderverein
            </Link>
            <Link as={RemixLink} to="/datenschutz">
              Datenschutz
            </Link>
          </HStack>
        </VStack>
      </HStack>
      <VStack>
        <HStack gap={4}>
          <Link
            as={RemixLink}
            to="https://facebook.com/kulturspektakel"
            title="Facebook"
          >
            <FaFacebook size={24} />
          </Link>
          <Link
            as={RemixLink}
            to="https://www.youtube.com/channel/UCLOU06fHSN3Hwe0rmbrFtpA"
            title="Youtube"
          >
            <FaYoutube size={24} />
          </Link>
          <Link
            as={RemixLink}
            to="https://instagram.com/kulturspektakel"
            title="Instagram"
          >
            <FaInstagram size={24} />
          </Link>
          <Link
            as={RemixLink}
            to="https://open.spotify.com/user/p7s6vlorvw05bxm881h5em4dj?si=4049483d01ec4fc3"
            title="Spotify"
          >
            <FaSpotify size={24} />
          </Link>
        </HStack>
        <Box mt={4}>
          Gefördert von
          <Image src={vpby} alt="Verband für Popkultur Logo" mt={-2} />
        </Box>
      </VStack>
    </Flex>
  );
}
