import {Box} from '@chakra-ui/react';
import Page from '../Page';
import {useSuspenseQuery} from '@tanstack/react-query';
import {pageLoader} from '../../server/routes/$slug';

export function StageInfo(props: {id: string}) {
  const {data} = useSuspenseQuery({
    queryKey: [props.id],
    queryFn: () => pageLoader({data: props.id}),
  });

  if (!data) {
    return;
  }
  return (
    <Box
      borderRadius="2xl"
      borderColor="offshite.200"
      borderStyle="solid"
      borderWidth={[undefined, 1]}
      px={[0, '3']}
      mt="4"
    >
      <Page left={data.left} right={data.right} />
    </Box>
  );
}
