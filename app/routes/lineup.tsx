import {Box, HStack, Heading} from '@chakra-ui/react';

import {Outlet, useParams} from '@remix-run/react';
import {$params} from 'remix-routes';
import Search from '~/components/lineup/Search';

export default function () {
  const params = useParams();
  return (
    <>
      <HStack justifyContent="space-between">
        <Heading>
          Lineup
          {params?.year && <>&nbsp;{params.year}</>}
        </Heading>
        <Search />
      </HStack>
      <Outlet />
    </>
  );
}
