import {Box, Heading} from '@chakra-ui/react';

import {Outlet} from '@remix-run/react';
import Search from '~/components/lineup/Search';

export default function () {
  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      <Heading>Lineup</Heading>
      <Search />
      <Outlet />
    </Box>
  );
}
