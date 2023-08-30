import {Box, Divider, HStack, Heading, Spacer} from '@chakra-ui/react';

import {Outlet} from '@remix-run/react';

export default function () {
  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      <HStack mb="5">
        <Heading size="lg">Bewerbungen</Heading>
        <Spacer />
      </HStack>
      <Divider mb="5" />
      <Outlet />
    </Box>
  );
}
