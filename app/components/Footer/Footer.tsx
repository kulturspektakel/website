import type {LinkProps} from '@chakra-ui/react';
import {Box, Flex, HStack, Link, VStack, Image, Text} from '@chakra-ui/react';
import type {NavLinkProps} from '@remix-run/react';
import {Link as RemixLink, NavLink} from '@remix-run/react';
import {FaSpotify, FaYoutube, FaInstagram, FaFacebook} from 'react-icons/fa6';
import vpby from './vpby.svg';
import {$path} from 'remix-routes';
import type {RemixLinkProps} from '@remix-run/react/dist/components';

export default function Footer() {
  return (
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
            <FooterLink to={$path('/booking')}>Booking</FooterLink>
            <FooterLink to={$path('/:slug', {slug: 'impressum'})}>
              Impressum
            </FooterLink>
            <FooterLink to={$path('/:slug', {slug: 'foerderverein'})}>
              Förderverein
            </FooterLink>
            <FooterLink to={$path('/:slug', {slug: 'datenschutz'})}>
              Datenschutz
            </FooterLink>
          </HStack>
        </VStack>
      </HStack>
      <VStack>
        <HStack gap={{base: 6, md: 4}} fontSize={{base: 32, md: 24}}>
          <FooterIcon
            to="https://facebook.com/kulturspektakel"
            title="Facebook"
            icon={FaFacebook}
          />
          <FooterIcon
            to="https://www.youtube.com/channel/UCLOU06fHSN3Hwe0rmbrFtpA"
            title="Youtube"
            icon={FaYoutube}
          />
          <FooterIcon
            to="https://instagram.com/kulturspektakel"
            title="Instagram"
            icon={FaInstagram}
          />
          <FooterIcon
            to="https://open.spotify.com/user/p7s6vlorvw05bxm881h5em4dj?si=4049483d01ec4fc3"
            title="Spotify"
            icon={FaSpotify}
          />
        </HStack>
        <Box mt="2" color="whiteAlpha.600">
          Gefördert von
          <Link as={RemixLink} to="https://popkultur.bayern" target="_blank">
            <Image src={vpby} alt="Verband für Popkultur" />
          </Link>
        </Box>
      </VStack>
    </Flex>
  );
}

function FooterIcon({
  icon: Icon,
  to,
  title,
}: LinkProps & RemixLinkProps & {icon: any}) {
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
      <RemixLink to={to}>
        <Icon />
      </RemixLink>
    </Link>
  );
}

function FooterLink({children, ...props}: LinkProps & NavLinkProps) {
  return (
    <Link
      as={NavLink}
      {...props}
      color="whiteAlpha.600"
      _hover={{color: 'white'}}
      _active={{color: 'white'}}
      _focus={{color: 'white'}}
    >
      {children}
    </Link>
  );
}
