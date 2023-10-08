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
      >
        <Heading as="h1">
          Lineup
          {params?.year && <>&nbsp;{params.year}</>}
        </Heading>
        <Search w={['100%', 'auto']} />
      </Stack>
      <Outlet />
    </>
  );
}
