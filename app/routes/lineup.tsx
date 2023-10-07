import {HStack, Heading} from '@chakra-ui/react';
import {Outlet, useParams} from '@remix-run/react';
import Search from '~/components/lineup/Search';

export default function () {
  const params = useParams();
  return (
    <>
      <HStack justifyContent="space-between" mb="5">
        <Heading as="h1">
          Lineup
          {params?.year && <>&nbsp;{params.year}</>}
        </Heading>
        <Search />
      </HStack>
      <Outlet />
    </>
  );
}
