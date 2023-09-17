import {Box, HStack, Heading} from '@chakra-ui/react';

import {Outlet, useParams} from '@remix-run/react';
import {$params} from 'remix-routes';
import Search from '~/components/lineup/Search';

export default function () {
  const params = useParams();
  console.log(params);
  return (
    <Box ml="auto" mr="auto" maxW="3xl" p="6">
      <HStack justifyContent="space-between">
        <Heading>
          Lineup
          {params?.year && <>&nbsp;{params.year}</>}
        </Heading>
        <Search />
      </HStack>
      <Outlet />
    </Box>
  );
}
