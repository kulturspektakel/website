import type {LinkProps} from '@chakra-ui/react';
import {
  Flex,
  HStack,
  Link,
  VStack,
  Image,
  Text,
  Heading,
  Stack,
} from '@chakra-ui/react';
import {FaSpotify, FaYoutube, FaInstagram, FaFacebook} from 'react-icons/fa6';
import vpby from './vpby.svg';
import LinkButton from '../LinkButton';
import {Link as RouterLink, useLocation} from '@tanstack/react-router';

export default function Footer() {
  const location = useLocation();
  return (
    <>
      {location.pathname !== '/spenden' && (
        <Stack
          as="aside"
          bgColor="offwhite.200"
          paddingY="8"
          paddingX={[8, 10, 16]}
          justify="space-between"
          alignItems="center"
          fontSize="sm"
          direction={{base: 'column', md: 'row'}}
          gap="4"
          textAlign={{base: 'center', md: 'left'}}
        >
          <div>
            <Heading mb="1">Unterstütze das Kult&hellip;</Heading>
            <Text>
              Als kostenloses und ehrenamtliches Festival sind wir auf eure
              Unterstützung angewiesen. Erfahre wie du uns mit Spenden und
              anderweitig helfen kannst.
            </Text>
          </div>
          <LinkButton variant="solid" href="/spenden">
            Mehr Erfahren
          </LinkButton>
        </Stack>
      )}
      <Flex
        as="footer"
        bgColor="brand.900"
        paddingY="8"
        paddingX={[8, 10, 16]}
        color="white"
        justify="space-between"
        direction={{base: 'column', md: 'row'}}
        gap={[8, 12, 20]}
        fontSize="sm"
      >
        <HStack
          alignItems="flex-start"
          maxW="500px"
          mx={{base: 'auto', md: 'initial'}}
        >
          <Image
            src={'/logos/logo.svg'}
            alt="Kulturspektakel Gauting Logo"
            width="40px"
            height="40px"
            display={{base: 'none', md: 'initial'}}
          />
          <VStack gap="2" align={{base: 'center', md: 'flex-start'}}>
            <Text as="h2" fontSize="md">
              Kulturspektakel Gauting e.V.
            </Text>
            <Text textAlign={{base: 'center', md: 'left'}} lineHeight="1.2">
              Das Kult ist ein dreitägiges ehrenamtlich von Jugendlichen
              organisiertes Musikfestival in Gauting.
            </Text>
            <HStack
              color="whiteAlpha.600"
              flexWrap={'wrap'}
              justifyContent={'center'}
            >
              <FooterLink to="/booking">Booking</FooterLink>
              <FooterLink to="/impressum">Impressum</FooterLink>
              <FooterLink to="/foerderverein">Förderverein</FooterLink>
              <FooterLink to="/datenschutz">Datenschutz</FooterLink>
            </HStack>
          </VStack>
        </HStack>
        <VStack>
          <HStack gap={{base: 6, md: 4}} fontSize={{base: 32, md: 24}}>
            <FooterIcon
              href="https://facebook.com/kulturspektakel"
              title="Facebook"
              icon={FaFacebook}
            />
            <FooterIcon
              href="https://www.youtube.com/channel/UCLOU06fHSN3Hwe0rmbrFtpA"
              title="Youtube"
              icon={FaYoutube}
            />
            <FooterIcon
              href="https://instagram.com/kulturspektakel"
              title="Instagram"
              icon={FaInstagram}
            />
            <FooterIcon
              href="https://open.spotify.com/user/p7s6vlorvw05bxm881h5em4dj?si=4049483d01ec4fc3"
              title="Spotify"
              icon={FaSpotify}
            />
          </HStack>
          {/* <Box mt="2" color="whiteAlpha.600">
          Gefördert von
          <Link href="https://popkultur.bayern" target="_blank">
            <Image src={vpby} alt="Verband für Popkultur" />
          </Link>
        </Box> */}
        </VStack>
      </Flex>
    </>
  );
}

function FooterIcon({icon: Icon, title, href}: LinkProps & {icon: any}) {
  return (
    <Link
      asChild
      title={title}
      target="_blank"
      color="white"
      _hover={{color: 'whiteAlpha.600'}}
      _active={{color: 'whiteAlpha.600'}}
      _focus={{color: 'whiteAlpha.600'}}
    >
      <RouterLink to={href}>
        <Icon />
      </RouterLink>
    </Link>
  );
}

function FooterLink({children, to}: {to: string; children: string}) {
  return (
    <Link
      color="whiteAlpha.600"
      _hover={{color: 'white'}}
      _active={{color: 'white'}}
      _focus={{color: 'white'}}
      asChild
    >
      <RouterLink to={to}>
        {(a) => (
          <Text color={a.isActive || a.isTransitioning ? 'white' : undefined}>
            {children}
          </Text>
        )}
      </RouterLink>
    </Link>
  );
}
