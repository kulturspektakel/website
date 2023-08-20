import {useParams} from '@remix-run/react';

export default function useIsDJ() {
  const {applicationType} = useParams();
  return applicationType === 'dj';
}
