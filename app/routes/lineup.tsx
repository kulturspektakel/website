import {Stack, Heading} from '@chakra-ui/react';
import {Outlet, useParams} from '@remix-run/react';
import Search from '~/components/lineup/Search';

export default function () {
  const params = useParams();
  return (
    <>
      <Stack
        direction={['column', 'row']}
        justifyContent="space-between"
        align={['start', 'center']}
        mb="5"
      >
        <Heading as="h1">
          Lineup
          {params?.year && <>&nbsp;{params.year}</>}
        </Heading>
        <Search />
      </Stack>
      <Outlet />
    </>
  );
}
