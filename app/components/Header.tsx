import {Box} from '@chakra-ui/react';
import {useLocation} from '@remix-run/react';

export default function Header() {
  const isHome = useLocation().pathname === '/';
  return (
    <Box as="header" bgColor="teal.600" h={isHome ? '32' : '12'}>
      Kulturspektakel Gauting
    </Box>
  );
}
