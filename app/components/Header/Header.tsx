import {Box, Image} from '@chakra-ui/react';
import {Link, useLocation} from '@remix-run/react';

export default function Header(props: {start: Date; end: Date}) {
  const isHome = useLocation().pathname === '/';
  return (
    <Box
      as="header"
      bgColor="brand.900"
      h={isHome ? '400' : ['60px', '60px', '90px']}
      p={[2, 2, 4]}
    >
      <Link to="https://kulturspektakel.de">
        <Image src={"/logo.svg"} alt="Kulturspektakel Gauting Logo" h="100%" />
      </Link>
    </Box>
  );
}
