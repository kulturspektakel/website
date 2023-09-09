import {Box} from '@chakra-ui/react';

import {Outlet} from '@remix-run/react';

export default function () {
  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      <Outlet />
    </Box>
  );
}
