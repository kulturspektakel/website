import {Box, Heading, Image} from '@chakra-ui/react';
import {useLocation} from '@remix-run/react';
import Logo from '../../public/logo.svg';

export default function Header() {
  const isHome = useLocation().pathname === '/';
  return (
    <Box as="header" bgColor="teal.600" h={isHome ? '32' : '12'}>
      <Image src={Logo} width={22} />
      <Heading as="h1">Kulturspektakel Gauting</Heading>
    </Box>
  );
}
