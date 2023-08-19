import {useMatches} from '@remix-run/react';

export default function useIsDJ() {
  const matches = useMatches();
  // console.log(matches);
  return false;
  // const {query} = useRouter();
  // return 'dj' == query['applicationType'];
}
